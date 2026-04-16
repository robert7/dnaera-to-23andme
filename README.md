# dnaera-to-23andme

Standalone converter that turns [DNAEra](https://dnaera.com/cs/o-nas/) raw exports into 23andMe-style raw data files so tools
with existing 23andMe import support can ingest them without code changes.

This project is a **best-effort compatibility bridge**, not a vendor-certified full-genome transcode. DNAEra does not publicly disclose the rsID mapping layer behind its raw exports, so this repo uses the exact manifest identifier found in the exported file header (`GSAMD-24v3-0-EA_20034606_A1.bpm`) plus public Illumina GSA v3 mapping files and targeted GRCh37 coordinate fallbacks. It is currently designed around the [getbased](https://getbased.health/) import use case and can **recover 41 of the 42 curated SNPs used there**; `rs8175347` is intentionally omitted. A possible user-side validation workflow is documented in [VALIDATION.md](VALIDATION.md).

Target application:

- getbased app: [https://app.getbased.health/](https://app.getbased.health/)
- getbased repository: [https://github.com/elkimek/get-based](https://github.com/elkimek/get-based)
- relevant getbased DNA docs: [docs/guide/dna-import.md](https://github.com/elkimek/get-based/blob/main/docs/guide/dna-import.md)

Target SNP set used by getbased and by this converter:

Methylation:
`rs1801131`, `rs1801133`, `rs1801394`, `rs1805087`, `rs234706`, `rs3733890`

Iron:
`rs1799945`, `rs1800562`, `rs2235321`, `rs3811647`, `rs855791`

Lipids:
`rs11591147`, `rs1800588`, `rs429358`, `rs708272`, `rs7412`

Vitamin D:
`rs10741657`, `rs10877012`, `rs2228570`, `rs2282679`

Vitamin B12:
`rs1801198`, `rs1801222`, `rs526934`, `rs601338`

Bilirubin:
`rs4148323`, `rs8175347`

Thyroid:
`rs11206244`, `rs179247`, `rs225014`

Fatty acids:
`rs174546`, `rs174547`, `rs174575`, `rs953413`

Blood sugar:
`rs1501299`, `rs1801282`, `rs2241766`, `rs7903146`

Sex hormones:
`rs1056836`, `rs1799941`, `rs6257`, `rs700518`, `rs743572`

## Quick Start

Convert a DNAEra export with the shell wrapper:

```bash
./conversion.sh ~/Downloads/dna-files/DNAEra-orig-12345.csv
```

This creates:

```text
~/Downloads/dna-files/DNAEra-orig-12345-converted-23andme.txt
~/Downloads/dna-files/DNAEra-orig-12345-filtered-target-snps.csv
~/Downloads/dna-files/DNAEra-orig-12345-validation-prompt-1.md
~/Downloads/dna-files/DNAEra-orig-12345-validation-prompt-2.md
```

The wrapper calls `convert-dnaera.js` and automatically derives all output filenames in the same directory as the input file.

The second artifact is a filtered DNAEra-style source subset containing only the rows relevant to the 42 target SNPs used by getbased. Its kept data rows are `1:1` copies of the original DNAEra source lines, so it can be used as a validation layer.

The third and fourth artifacts are AI-ready validation prompts with the actual filtered and converted file contents already embedded for copy/paste use.

## Status And Limits

- This repo provides a standalone converter, not changes to getbased or DNAEra.
- Its primary objective is to make DNAEra raw exports importable into the getbased app: `https://app.getbased.health/`
- It emits 23andMe-style tab-separated output with DNAEra metadata preserved as comments.
- It is optimized for the SNPs getbased actually imports, not for perfect reconstruction of the full DNAEra array.
- The exact custom manifest named in the DNAEra export header has not been downloaded into this repo.
- Publicly downloadable artifacts used here are generic Illumina `GSA v3 A1` files, not the exact `GSAMD-24v3-0-EA_20034606_A1` custom manifest.
- `rs8175347` is omitted because the UGT1A1 TA-repeat polymorphism is not safely recoverable from the public SNP-style mapping used here.

## Objectives

- Primary objective: make DNAEra raw exports importable into the getbased app without changing getbased itself.
- Convert DNAEra raw exports into a format that getbased already supports.
- Avoid modifying the getbased app itself.
- Preserve useful source metadata from DNAEra exports.
- Make the mapping assumptions and risks explicit.

## Ask DNAEra

If you want a cleaner and more reliable conversion path, ask DNAEra support for the underlying mapping data instead of relying on best-effort public reconstruction.

Included in this repo:

- [email-to-dnaera-support-sk.md](email-to-dnaera-support-sk.md) - short polite Slovak email template requesting the manifest or mapping table

Recommended request:

- send the text in [email-to-dnaera-support-sk.md](email-to-dnaera-support-sk.md) to DNAEra support
- ask specifically for:
  - the manifest for the export format they provide
  - `SNP Name -> rsID` mapping
  - or `SNP Name / Chr / Position -> rsID` mapping

If DNAEra provides an official mapping table or official compatible export, that should take priority over the fallback mapping strategy used in this repo.

## What We Found

### DNAEra public disclosures

DNAEra publicly says that:

- their lab genotypes about `700 000 vybranych miest v DNA`
- the lab output is `surove data (RAW data)`
- they process those raw data into customer-facing results using `nami vyvinutych algoritmov`
- raw data and interpreted results are available in the user's account

Relevant public URLs:

- `https://dnaera.com/co-robime/`
- `https://app.dnaera.com/assets/en-dna-era_terms-of-use_web-app.pdf`

Relevant text fragments from `https://dnaera.com/co-robime/`:

- `700 000 vybranych miest v DNA`
- `Vystupom z analyzy su surove data (RAW data), ktore nasledne spracovavame do konkretnych vysledkov pomocou nami vyvinutych algoritmov`
- `Vysledna analyza, ako aj surove data su zakaznikom k dispozicii na ich ucte na nasom webe`

Relevant text fragment from the Terms PDF:

- `genetic raw data files`

### What DNAEra does not disclose

DNAEra's public site does not appear to disclose:

- any explicit rsID mapping source
- any public manifest download
- any mention of Illumina
- any mention of `GSAMD-24v3-0-EA_20034606_A1`
- any mention of `.bpm`
- any mention of a loci-to-rsID conversion file
- any explanation of how their internal algorithms map array loci or probe names to rsIDs

So DNAEra publicly confirms that raw data exist, but does not document the technical mapping layer needed for conversion.

### Local export evidence

The strongest concrete technical clue is in the exported file itself:

```text
[Header]
GSGT Version,2.0.5
Processing Date,8/14/2023 10:59 PM
Content,,GSAMD-24v3-0-EA_20034606_A1.bpm
Num SNPs,730059
```

That exact manifest identifier came from the customer's own export header, not from guesswork or marketing copy. It is the main reason this repo is built around the manifest lineage implied by:

- `GSAMD-24v3-0-EA_20034606_A1.bpm`

## How The Converter Works

### Input format

The converter expects DNAEra exports shaped like:

```text
[Header]
...
[Data]
Sample Name,SNP Name,Chr,Position,Allele1 - Plus,Allele2 - Plus
```

### How the current mapping was built

The current conversion logic was assembled in this order:

1. Read the exact manifest identifier from the DNAEra export header:
   - `GSAMD-24v3-0-EA_20034606_A1.bpm`
2. Use the public Illumina `GSA-24v3-0_A1_b151_rsids.txt` file for direct `Name -> rsID` mapping where possible.
3. Compare that public mapping against the 42 curated SNPs that getbased currently imports.
4. Fill the getbased-critical gaps with targeted GRCh37 coordinate fallbacks from the NCBI Variation API.
5. Intentionally omit `rs8175347`, because it is a repeat polymorphism and was not considered safe to reconstruct as a simple SNP call from the public mapping used here.

This means the repo preserves the exact fallback logic that was used to build the current mapping, even though it is still a best-effort bridge rather than an official vendor mapping.

### Mapping strategy

The converter uses two mapping layers:

1. Direct `Name -> rsID` aliases from Illumina's public `GSA-24v3-0_A1_b151_rsids.txt`
2. Targeted GRCh37 coordinate fallbacks for missing getbased SNPs

This is a pragmatic bridge for downstream compatibility. It should not be described as a full vendor-certified transcode of the entire DNAEra array.

### Output format

The converter writes four artifacts:

1. A 23andMe-style text file:

```text
# This data file generated by 23andMe at: ...
# Converted from DNAEra raw export for getbased compatibility
# Original content: GSAMD-24v3-0-EA_20034606_A1.bpm
rsid	chromosome	position	genotype
...
```

2. A filtered DNAEra-style CSV subset:

```text
[Header]
...
[Data]
Sample Name,SNP Name,Chr,Position,Allele1 - Plus,Allele2 - Plus
...
```

This is also deliberate:

- the comment block contains `generated by 23andMe`
- the data body uses tab-separated `rsid chromosome position genotype`
- the filtered CSV preserves only the original DNAEra rows that are relevant to the 42 target SNPs
- the kept data rows are copied directly from the input file rather than reconstructed
- conflicting duplicates are kept in the filtered CSV if they map to a target SNP, so the validation slice is not silently simplified

3. A rendered validation prompt for step 1:

- `*-validation-prompt-1.md`
- contains the actual `*-filtered-target-snps.csv` content embedded into an AI prompt

4. A rendered validation prompt for step 2:

- `*-validation-prompt-2.md`
- contains the actual `*-converted-23andme.txt` content embedded into an AI prompt

That matches the existing import pattern expected by getbased.

## Current Decision Record

- Scope is intentionally limited to the 42 curated SNPs that getbased currently imports.
- The converter does not modify getbased and instead emits a format that getbased already accepts.
- The runtime stays dependency-light and uses built-in Node.js modules only.
- The current fallback mapping should be replaced if DNAEra provides an official manifest or mapping table.
- The exact `GSAMD` files discovered later are important future leads, but they are not yet incorporated into the current converter logic because download/preview failed.

## CLI Usage

Convert to the default output path:

```bash
node convert-dnaera.js path/to/DNAEra-export.txt
```

Write converted output to stdout:

```bash
node convert-dnaera.js path/to/DNAEra-export.txt --stdout
```

Use an explicit output file:

```bash
node convert-dnaera.js path/to/DNAEra-export.txt path/to/output-23andme.txt
```

Override the mapping JSON:

```bash
node convert-dnaera.js path/to/DNAEra-export.txt --mapping mapping/getbased-dnaera-map.json
```

## Testing

Run the test suite:

```bash
./code-quality.sh
```

Run the test suite with coverage thresholds:

```bash
npm run test:coverage
```

Coverage policy in this repo:

- minimum `85%` for lines, functions, and branches on `convert-dnaera.js`

## Repository Contents

- `AGENTS.md` - contributor guidance for future edits to this repo
- `convert-dnaera.js` - standalone Node.js CLI converter
- `conversion.sh` - short shell wrapper that converts one DNAEra export and writes four derived output files
- [email-to-dnaera-support-sk.md](email-to-dnaera-support-sk.md) - Slovak email template requesting the manifest or mapping table from DNAEra support
- [VALIDATION.md](VALIDATION.md) - step-by-step manual for validating the conversion process with the filtered source subset and converted output
- `package.json` - zero-dependency Node.js scripts for tests and coverage
- [validation-prompt-1.md](validation-prompt-1.md) - generic template for the first AI-assisted validation step
- [validation-prompt-2.md](validation-prompt-2.md) - generic template for the second AI-assisted validation step
- `mapping/getbased-dnaera-map.json` - compact mapping focused on getbased's curated SNP set
- `samples/dnaera-mini.txt` - small fixture for local testing
- `test/convert-dnaera.test.js` - Node.js test suite covering converter behavior and CLI output
- `GSA-24v3-0_A1_b151_rsids.txt` - unpacked public Illumina loci-to-rsID file
- `infinium-global-screening-array-24-v3-0-a1-b151-rsids.zip` - original downloaded Illumina rsID conversion zip
- `GSA-24v3-0-A1-manifest-file-csv.zip` - public Illumina GSA v3 A1 manifest CSV zip

## Provenance

### Downloaded and used directly

Illumina public loci-to-rsID conversion file:

- download URL:
  - `https://support.illumina.com/content/dam/illumina-support/documents/downloads/productfiles/global-screening-array-24/v3-0/infinium-global-screening-array-24-v3-0-a1-b151-rsids.zip`
- Illumina page label:
  - `Infinium Global Screening Array v3.0 Loci Name to rsID Conversion File`
- page source:
  - `https://support.illumina.com/array/array_kits/infinium-global-screening-array/downloads.html`

Illumina public GSA v3 A1 manifest CSV:

- download URL:
  - `https://support.illumina.com/content/dam/illumina-support/documents/downloads/productfiles/global-screening-array-24/v3-0/GSA-24v3-0-A1-manifest-file-csv.zip`
- Illumina page label:
  - `Infinium Global Screening Array v3.0 Manifest File (CSV Format - GRCh37)`
- page source:
  - `https://support.illumina.com/array/array_kits/infinium-global-screening-array/downloads.html`

### Exact `GSAMD` lead found later, but not downloaded here

We later found exact `GSAMD-24v3-0-EA_20034606_A1` artifacts via 42basepairs, including:

- `GSAMD-24v3-0-EA_20034606_A1.2.0.extended.csv`
- `GSAMD-24v3-0-EA_20034606_A1.csv`
- `GSAMD-24v3-0-EA_20034606_A1.2.0.report.txt`
- `GSAMD-24v3-0-EA_20034606_A1.1.5.extended.csv`
- `GSAMD-24v3-0-EA_20034606_A1.1.5.report.txt`

We also found a public metadata page referencing the exact DNAEra header identifier:

- https://42basepairs.com/browse/gs/broad-public-datasets/IlluminaGenotypingArrays/metadata/GSAMD-24v3-0-EA_20034606_A1

Why it matters:

- it shows that `GSAMD-24v3-0-EA_20034606_A1` exists as a real metadata object name in a public dataset context
- it is the most promising future source for improving or replacing the current fallback mapping

Why it is not included in this repo:

- the backing Broad bucket is requester-pays
- direct object fetch without a billing project returned:
  - `UserProjectMissing`
- preview/download through 42basepairs also failed for the exact `GSAMD` files we tried

So the exact `GSAMD` custom manifest remains the preferred technical source, but not the artifact currently available in this repo.

Also tried: https://42basepairs.com/search?query=GSAMD-24v3-0-EA_20034606_A1

https://42basepairs.com/search?query=GSAMD-24v3-0-EA_20034606_A1&file=GSAMD-24v3-0-EA_20034606_A1.2.0.extended.csv&preview=

result:

```text
GSAMD-24v3-0-EA_20034606_A1.2.0.extended.csv

Could not preview this file: Error: Couldn't load https://42basepairs.com/download/gs/broad-public-datasets/IlluminaGenotypingArrays/metadata/GSAMD-24v3-0-EA_20034606_A1/GSAMD-24v3-0-EA_20034606_A1.2.0.extended.csv. Status: 400
```

## Coverage

Coverage against getbased's curated SNP set:

- targeted rsIDs: `42`
- currently recoverable: `41`
- intentionally omitted: `1`

Known omission:

- `rs8175347`
  - UGT1A1 TA repeat
  - not represented as a simple SNP call in the public mapping used here
  - intentionally left out rather than fabricated

## Validation

Completed checks so far:

- the converter runs against `samples/dnaera-mini.txt`
- direct name mapping works
- coordinate fallbacks work, including APOE component `rs429358`
- file output works
- the converter was run against the truncated file `DNAEra-orig-41220311706341-head.txt`
  - result: `0 of 42`
  - expected because that file is only a head slice and does not include the later target loci

## What This Repo Does Not Claim

- It does not claim full fidelity for all loci in the DNAEra export.
- It does not claim that the public generic GSA v3 A1 files are identical to the exact custom GSAMD manifest used by DNAEra.
- It does not claim that every downstream consumer besides getbased will interpret the output the same way.
- It does not claim support for repeat polymorphisms that are not safely reconstructable from the public mapping used here.
