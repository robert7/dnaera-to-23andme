#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_MAPPING_PATH = path.join(__dirname, 'mapping', 'getbased-dnaera-map.json');

function parseArgs(argv) {
  const args = {
    mappingPath: DEFAULT_MAPPING_PATH,
    inputPath: null,
    outputPath: null,
    stdout: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mapping') {
      args.mappingPath = argv[i + 1];
      i += 1;
    } else if (arg === '--stdout') {
      args.stdout = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage(0);
    } else if (!args.inputPath) {
      args.inputPath = arg;
    } else if (!args.outputPath) {
      args.outputPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!args.inputPath) {
    printUsage(1);
  }

  if (!args.stdout && !args.outputPath) {
    const ext = path.extname(args.inputPath);
    const base = ext ? args.inputPath.slice(0, -ext.length) : args.inputPath;
    args.outputPath = `${base}.23andme.txt`;
  }

  return args;
}

function printUsage(exitCode) {
  const usage = [
    'Usage:',
    '  node DNAEra-conversion/convert-dnaera.js <input> [output]',
    '  node DNAEra-conversion/convert-dnaera.js <input> --stdout',
    '',
    'Options:',
    '  --mapping <file>   Override the default compact mapping JSON',
    '  --stdout           Write converted output to stdout instead of a file',
  ].join('\n');
  process.stdout.write(`${usage}\n`);
  process.exit(exitCode);
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function normalizeAllele(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeChromosome(value) {
  const chr = String(value || '').trim().toUpperCase();
  if (!chr) return '';
  if (chr.startsWith('CHR')) return chr.slice(3);
  return chr;
}

function chromosomeSortValue(chr) {
  if (/^\d+$/.test(chr)) return Number(chr);
  if (chr === 'X') return 23;
  if (chr === 'Y') return 24;
  if (chr === 'XY') return 25;
  if (chr === 'MT' || chr === 'M') return 26;
  return 100;
}

function parseDNAEraFile(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const metadata = {};
  const metadataLines = [];
  const rows = [];
  let inHeader = false;
  let inData = false;
  let dataColumns = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line === '[Header]') {
      inHeader = true;
      inData = false;
      continue;
    }
    if (line === '[Data]') {
      inHeader = false;
      inData = true;
      dataColumns = null;
      continue;
    }

    if (inHeader) {
      const parts = parseCsvLine(line);
      const key = String(parts[0] || '').trim();
      if (!key) continue;
      const value = parts.slice(1).map(part => part.trim()).filter(Boolean).join(', ');
      metadata[key] = value;
      metadataLines.push(line);
      continue;
    }

    if (inData && !dataColumns) {
      dataColumns = parseCsvLine(line).map(part => part.trim());
      continue;
    }

    if (inData && dataColumns) {
      const values = parseCsvLine(line);
      const row = {};
      dataColumns.forEach((column, index) => {
        row[column] = (values[index] || '').trim();
      });
      rows.push(row);
    }
  }

  return { metadata, metadataLines, rows };
}

function resolveRsid(row, mapping) {
  const snpName = String(row['SNP Name'] || '').trim();
  const chr = normalizeChromosome(row.Chr);
  const position = String(row.Position || '').trim();
  const coordinateKey = chr && position ? `${chr}:${position}` : null;

  if (snpName && mapping.byName[snpName]) {
    return { rsid: mapping.byName[snpName], mode: 'name', key: snpName };
  }

  if (snpName.startsWith('GSA-') && mapping.byName[snpName.slice(4)]) {
    return { rsid: mapping.byName[snpName.slice(4)], mode: 'name', key: snpName.slice(4) };
  }

  if (snpName.startsWith('rs')) {
    return { rsid: snpName, mode: 'name', key: snpName };
  }

  if (coordinateKey && mapping.byCoord[coordinateKey]) {
    return { rsid: mapping.byCoord[coordinateKey], mode: 'coord', key: coordinateKey };
  }

  return null;
}

function buildOutput(parsed, mapping) {
  const targetSet = new Set(mapping.targetRsids);
  const matches = new Map();
  const stats = {
    directName: 0,
    coordinateFallback: 0,
    skippedNoCall: 0,
    skippedUnmapped: 0,
    conflicts: [],
  };

  for (const row of parsed.rows) {
    const allele1 = normalizeAllele(row['Allele1 - Plus']);
    const allele2 = normalizeAllele(row['Allele2 - Plus']);
    if (!allele1 || !allele2 || allele1 === '-' || allele2 === '-' || allele1 === '0' || allele2 === '0') {
      stats.skippedNoCall += 1;
      continue;
    }

    const resolved = resolveRsid(row, mapping);
    if (!resolved || !targetSet.has(resolved.rsid)) {
      stats.skippedUnmapped += 1;
      continue;
    }

    const chromosome = normalizeChromosome(row.Chr);
    const position = Number.parseInt(String(row.Position || '').trim(), 10);
    if (!chromosome || !Number.isFinite(position)) {
      stats.skippedUnmapped += 1;
      continue;
    }

    const genotype = `${allele1}${allele2}`;
    const quality = resolved.mode === 'name' ? 2 : 1;
    const existing = matches.get(resolved.rsid);

    if (!existing || quality > existing.quality) {
      matches.set(resolved.rsid, {
        rsid: resolved.rsid,
        chromosome,
        position,
        genotype,
        quality,
        sourceName: row['SNP Name'],
        sourceMode: resolved.mode,
      });
      if (!existing) {
        if (resolved.mode === 'name') stats.directName += 1;
        else stats.coordinateFallback += 1;
      }
    } else if (existing.genotype !== genotype || existing.position !== position) {
      stats.conflicts.push(
        `${resolved.rsid}: kept ${existing.genotype} from ${existing.sourceName}, ignored ${genotype} from ${row['SNP Name']}`
      );
    }
  }

  const sortedEntries = Array.from(matches.values()).sort((a, b) => {
    const chrDiff = chromosomeSortValue(a.chromosome) - chromosomeSortValue(b.chromosome);
    if (chrDiff !== 0) return chrDiff;
    return a.position - b.position;
  });

  const generatedAt = new Date().toISOString();
  const commentLines = [
    `# This data file generated by 23andMe at: ${generatedAt}`,
    '# Converted from DNAEra raw export for getbased compatibility',
  ];

  if (parsed.metadata.Content) commentLines.push(`# Original content: ${parsed.metadata.Content}`);
  if (parsed.metadata['Processing Date']) commentLines.push(`# Original processing date: ${parsed.metadata['Processing Date']}`);
  commentLines.push('# Mapping sources:');
  commentLines.push(`#   - ${mapping.sources.nameToRsidOrigin} (${mapping.sources.nameToRsidFile})`);
  commentLines.push(`#   - ${mapping.sources.coordinateFallbackOrigin}`);
  commentLines.push(`# Targeted rsIDs recovered: ${sortedEntries.length} of ${targetSet.size}`);

  for (const [rsid, reason] of Object.entries(mapping.unsupported || {})) {
    commentLines.push(`# Omitted by design: ${rsid} - ${reason}`);
  }

  const outputLines = [
    ...commentLines,
    'rsid\tchromosome\tposition\tgenotype',
    ...sortedEntries.map(entry => `${entry.rsid}\t${entry.chromosome}\t${entry.position}\t${entry.genotype}`),
  ];

  const missingTargets = Array.from(targetSet).filter(rsid => !matches.has(rsid));

  return {
    text: `${outputLines.join('\n')}\n`,
    stats,
    matchedEntries: sortedEntries,
    missingTargets,
  };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const mapping = JSON.parse(fs.readFileSync(args.mappingPath, 'utf8'));
    const content = fs.readFileSync(args.inputPath, 'utf8');
    const parsed = parseDNAEraFile(content);
    const result = buildOutput(parsed, mapping);

    if (args.stdout) {
      process.stdout.write(result.text);
    } else {
      fs.writeFileSync(args.outputPath, result.text, 'utf8');
    }

    const destination = args.stdout ? 'stdout' : args.outputPath;
    console.error(`Converted ${result.matchedEntries.length} target SNPs to ${destination}`);
    console.error(`Direct name matches: ${result.stats.directName}`);
    console.error(`Coordinate fallback matches: ${result.stats.coordinateFallback}`);
    if (result.missingTargets.length) {
      console.error(`Missing targets (${result.missingTargets.length}): ${result.missingTargets.join(', ')}`);
    }
    if (result.stats.conflicts.length) {
      console.error(`Conflicts (${result.stats.conflicts.length}):`);
      result.stats.conflicts.forEach(conflict => console.error(`  - ${conflict}`));
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
