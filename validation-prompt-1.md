# Validation Prompt 1

Use this prompt with an AI model for the first validation step.

Replace:

- `{{FILTERED_TARGET_SNPS_FILE}}` with your actual `*-filtered-target-snps.csv` file

---

Please review the file `{{FILTERED_TARGET_SNPS_FILE}}`.

This file is a filtered subset of an original DNAEra raw export. It contains only the original source rows relevant to the curated set of 42 target SNPs used by getbased.

Use only:

- this filtered DNAEra source subset
- the target SNP list below

Do **not** use any converted 23andMe-style file yet.
Do **not** infer markers that are not supported by the provided source lines.
Do **not** provide medical interpretation.
Do **not** disclose personal genotype values in the summary unless explicitly asked.

The 42 target SNPs are:

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

For each target SNP, classify it into exactly one of these categories:

- directly detected
- detected after normalization or alias mapping
- present but not callable
- not recovered

Special note:

- `rs8175347` is a repeat polymorphism and may need to be treated as a special case rather than as a standard simple SNP

Please return:

1. A table with one row per target SNP
   Columns:
   - SNP
   - category
   - short explanation

2. A short summary with:
   - number directly detected
   - number detected after normalization or alias mapping
   - number present but not callable
   - number not recovered

3. A final section titled `Recovered subset for cross-format comparison`
   Include only the SNP identifiers that you believe are sufficiently recovered/callable to compare against a converted 23andMe-style file in the next step.
