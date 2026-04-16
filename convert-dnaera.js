#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_MAPPING_PATH = path.join(__dirname, 'mapping', 'getbased-dnaera-map.json');
const TARGET_SNP_LIST_TEXT = [
  'Methylation:',
  '`rs1801131`, `rs1801133`, `rs1801394`, `rs1805087`, `rs234706`, `rs3733890`',
  '',
  'Iron:',
  '`rs1799945`, `rs1800562`, `rs2235321`, `rs3811647`, `rs855791`',
  '',
  'Lipids:',
  '`rs11591147`, `rs1800588`, `rs429358`, `rs708272`, `rs7412`',
  '',
  'Vitamin D:',
  '`rs10741657`, `rs10877012`, `rs2228570`, `rs2282679`',
  '',
  'Vitamin B12:',
  '`rs1801198`, `rs1801222`, `rs526934`, `rs601338`',
  '',
  'Bilirubin:',
  '`rs4148323`, `rs8175347`',
  '',
  'Thyroid:',
  '`rs11206244`, `rs179247`, `rs225014`',
  '',
  'Fatty acids:',
  '`rs174546`, `rs174547`, `rs174575`, `rs953413`',
  '',
  'Blood sugar:',
  '`rs1501299`, `rs1801282`, `rs2241766`, `rs7903146`',
  '',
  'Sex hormones:',
  '`rs1056836`, `rs1799941`, `rs6257`, `rs700518`, `rs743572`',
].join('\n');

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
    '  node convert-dnaera.js <input> [output]',
    '  node convert-dnaera.js <input> --stdout',
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

function toCsvLine(values) {
  return values.map((value) => {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }).join(',');
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
  let dataHeaderLine = null;
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
      dataHeaderLine = rawLine;
      dataColumns = parseCsvLine(line).map(part => part.trim());
      continue;
    }

    if (inData && dataColumns) {
      const values = parseCsvLine(line);
      const row = { __rawLine: rawLine };
      dataColumns.forEach((column, index) => {
        row[column] = (values[index] || '').trim();
      });
      rows.push(row);
    }
  }

  return { metadata, metadataLines, rows, dataColumns, dataHeaderLine };
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

function buildFilteredInputSubset(parsed, mapping) {
  const targetSet = new Set(mapping.targetRsids);
  const relevantRows = parsed.rows.filter((row) => {
    const resolved = resolveRsid(row, mapping);
    return resolved && targetSet.has(resolved.rsid);
  });

  const headerLines = [
    '[Header]',
    ...parsed.metadataLines,
    '[Data]',
    parsed.dataHeaderLine || toCsvLine(parsed.dataColumns || []),
  ];

  const dataLines = relevantRows.map((row) => row.__rawLine || toCsvLine((parsed.dataColumns || []).map((column) => row[column] || '')));

  return {
    text: `${[...headerLines, ...dataLines].join('\n')}\n`,
    relevantRows,
  };
}

function deriveFilteredOutputPath(inputPath) {
  const ext = path.extname(inputPath);
  const base = ext ? inputPath.slice(0, -ext.length) : inputPath;
  return `${base}-filtered-target-snps.csv`;
}

function deriveValidationPrompt1Path(inputPath) {
  const ext = path.extname(inputPath);
  const base = ext ? inputPath.slice(0, -ext.length) : inputPath;
  return `${base}-validation-prompt-1.md`;
}

function deriveValidationPrompt2Path(inputPath) {
  const ext = path.extname(inputPath);
  const base = ext ? inputPath.slice(0, -ext.length) : inputPath;
  return `${base}-validation-prompt-2.md`;
}

function buildValidationPrompt1(filteredText, filteredPath) {
  return [
    '# Validation Prompt 1',
    '',
    'Copy and paste everything below into your AI model.',
    '',
    'Please review the following filtered DNAEra source subset.',
    '',
    `Source file: \`${filteredPath}\``,
    '',
    'This file is a filtered subset of an original DNAEra raw export. It contains only the original source rows relevant to the curated set of 42 target SNPs used by getbased.',
    '',
    'Use only:',
    '',
    '- this filtered DNAEra source subset',
    '- the target SNP list below',
    '',
    'Do **not** use any converted 23andMe-style file yet.',
    'Do **not** infer markers that are not supported by the provided source lines.',
    'Do **not** provide medical interpretation.',
    'Do **not** disclose personal genotype values in the summary unless explicitly asked.',
    '',
    'The 42 target SNPs are:',
    '',
    TARGET_SNP_LIST_TEXT,
    '',
    'For each target SNP, classify it into exactly one of these categories:',
    '',
    '- directly detected',
    '- detected after normalization or alias mapping',
    '- present but not callable',
    '- not recovered',
    '',
    'Special note:',
    '',
    '- `rs8175347` is a repeat polymorphism and may need to be treated as a special case rather than as a standard simple SNP',
    '',
    'Please return:',
    '',
    '1. A table with one row per target SNP',
    '   Columns:',
    '   - SNP',
    '   - category',
    '   - short explanation',
    '',
    '2. A short summary with:',
    '   - number directly detected',
    '   - number detected after normalization or alias mapping',
    '   - number present but not callable',
    '   - number not recovered',
    '',
    '3. A final section titled `Recovered subset for cross-format comparison`',
    '   Include only the SNP identifiers that you believe are sufficiently recovered/callable to compare against a converted 23andMe-style file in the next step.',
    '',
    'Filtered DNAEra source subset:',
    '',
    '```text',
    filteredText.trimEnd(),
    '```',
    '',
  ].join('\n');
}

function buildValidationPrompt2(convertedText, convertedPath) {
  return [
    '# Validation Prompt 2',
    '',
    'Copy and paste everything below into your AI model after completing validation prompt 1.',
    '',
    'Now compare the recovered callable target SNP subset from step 1 against the converted 23andMe-style file below.',
    '',
    `Converted file: \`${convertedPath}\``,
    '',
    'Use:',
    '',
    '- your conclusions from the previous step based on the filtered DNAEra source subset',
    '- the converted 23andMe-style file below',
    '',
    'Do **not** infer loci outside the curated target set.',
    'Do **not** provide medical interpretation.',
    'Do **not** disclose personal genotype values in the summary unless explicitly asked.',
    '',
    'Please check:',
    '',
    '- whether the same callable target loci are present in the converted file',
    '- whether the calls are concordant at the marker level',
    '- whether any differences are explained by no-calls, normalization limits, repeat-polymorphism handling, or markers unsuitable for simple rsID output',
    '',
    'Special note:',
    '',
    '- `rs8175347` should be treated as a special case and should not be judged by the same standard as ordinary simple SNP calls',
    '',
    'Please return:',
    '',
    '1. A comparison summary with:',
    '   - callable target SNPs recovered from the filtered DNAEra subset',
    '   - how many of those are present in the converted file',
    '   - how many are concordant',
    '   - how many differ',
    '',
    '2. A short list of any discrepancies',
    '   For each discrepancy, explain whether it appears to be:',
    '   - a likely conversion problem',
    '   - an acceptable no-call / unsupported-marker case',
    '   - a special-case marker issue',
    '',
    '3. A final verdict in plain language',
    '   Example style:',
    '   - very strong match',
    '   - good match with a few explainable exceptions',
    '   - mixed result requiring manual review',
    '',
    'Converted 23andMe-style file:',
    '',
    '```text',
    convertedText.trimEnd(),
    '```',
    '',
  ].join('\n');
}

function main() {
  return runCli(process.argv.slice(2));
}

function runCli(argv) {
  try {
    const args = parseArgs(argv);
    const mapping = JSON.parse(fs.readFileSync(args.mappingPath, 'utf8'));
    const content = fs.readFileSync(args.inputPath, 'utf8');
    const parsed = parseDNAEraFile(content);
    const result = buildOutput(parsed, mapping);

    if (args.stdout) {
      process.stdout.write(result.text);
    } else {
      fs.writeFileSync(args.outputPath, result.text, 'utf8');
      const filteredOutputPath = deriveFilteredOutputPath(args.inputPath);
      const filtered = buildFilteredInputSubset(parsed, mapping);
      fs.writeFileSync(filteredOutputPath, filtered.text, 'utf8');
      const prompt1Path = deriveValidationPrompt1Path(args.inputPath);
      const prompt2Path = deriveValidationPrompt2Path(args.inputPath);
      fs.writeFileSync(prompt1Path, buildValidationPrompt1(filtered.text, filteredOutputPath), 'utf8');
      fs.writeFileSync(prompt2Path, buildValidationPrompt2(result.text, args.outputPath), 'utf8');
      result.filteredOutputPath = filteredOutputPath;
      result.filteredRowCount = filtered.relevantRows.length;
      result.validationPrompt1Path = prompt1Path;
      result.validationPrompt2Path = prompt2Path;
    }

    const destination = args.stdout ? 'stdout' : args.outputPath;
    console.error(`Converted ${result.matchedEntries.length} target SNPs to ${destination}`);
    console.error(`Direct name matches: ${result.stats.directName}`);
    console.error(`Coordinate fallback matches: ${result.stats.coordinateFallback}`);
    if (!args.stdout) {
      console.error(`Filtered source rows written: ${result.filteredRowCount} to ${result.filteredOutputPath}`);
      console.error(`Validation prompt 1 written: ${result.validationPrompt1Path}`);
      console.error(`Validation prompt 2 written: ${result.validationPrompt2Path}`);
    }
    if (result.missingTargets.length) {
      console.error(`Missing targets (${result.missingTargets.length}): ${result.missingTargets.join(', ')}`);
    }
    if (result.stats.conflicts.length) {
      console.error(`Conflicts (${result.stats.conflicts.length}):`);
      result.stats.conflicts.forEach(conflict => console.error(`  - ${conflict}`));
    }
    return result;
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_MAPPING_PATH,
  buildOutput,
  buildFilteredInputSubset,
  buildValidationPrompt1,
  buildValidationPrompt2,
  chromosomeSortValue,
  deriveFilteredOutputPath,
  deriveValidationPrompt1Path,
  deriveValidationPrompt2Path,
  main,
  normalizeAllele,
  normalizeChromosome,
  parseArgs,
  parseCsvLine,
  parseDNAEraFile,
  printUsage,
  resolveRsid,
  runCli,
  toCsvLine,
};

if (require.main === module) {
  main();
}
