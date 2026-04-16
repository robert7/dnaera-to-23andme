# Validation Manual

This document describes one practical way to validate the conversion process with your own DNAEra data.

The goal is **not** to prove that the conversion is universally correct. The goal is to check whether the converted 23andMe-style file is consistent with the relevant source rows from the original DNAEra export for the curated set of 42 SNPs targeted by this repo.

## Purpose

This validation process is designed to answer a narrow question:

- do the target SNPs recovered from the original DNAEra source rows match the target SNPs written into the converted 23andMe-style file?

This process is about:

- locus recovery
- callability
- cross-format consistency

This process is **not** about:

- ancestry interpretation
- medical interpretation
- validating all loci in the original DNAEra export

## Inputs

You need three inputs:

1. `*-filtered-target-snps.csv`
   - produced by this repo
   - contains only the original DNAEra source rows relevant to the 42 target SNPs
   - kept data rows are copied `1:1` from the original DNAEra input

2. The list of 42 target SNPs used by getbased

3. `*-converted-23andme.txt`
   - produced by this repo
   - the normalized 23andMe-style output

## The 42 target SNPs

Methylation:

- `rs1801131`
- `rs1801133`
- `rs1801394`
- `rs1805087`
- `rs234706`
- `rs3733890`

Iron:

- `rs1799945`
- `rs1800562`
- `rs2235321`
- `rs3811647`
- `rs855791`

Lipids:

- `rs11591147`
- `rs1800588`
- `rs429358`
- `rs708272`
- `rs7412`

Vitamin D:

- `rs10741657`
- `rs10877012`
- `rs2228570`
- `rs2282679`

Vitamin B12:

- `rs1801198`
- `rs1801222`
- `rs526934`
- `rs601338`

Bilirubin:

- `rs4148323`
- `rs8175347`

Thyroid:

- `rs11206244`
- `rs179247`
- `rs225014`

Fatty acids:

- `rs174546`
- `rs174547`
- `rs174575`
- `rs953413`

Blood sugar:

- `rs1501299`
- `rs1801282`
- `rs2241766`
- `rs7903146`

Sex hormones:

- `rs1056836`
- `rs1799941`
- `rs6257`
- `rs700518`
- `rs743572`

## Suggested validation workflow

### Step 1: Generate the two converter outputs

Run:

```bash
./conversion.sh /path/to/DNAEra-export.csv
```

This should produce:

- `*-converted-23andme.txt`
- `*-filtered-target-snps.csv`
- `*-validation-prompt-1.md`
- `*-validation-prompt-2.md`

Prompt templates for the two AI-assisted validation steps are available here:

- [validation-prompt-1.md](validation-prompt-1.md)
- [validation-prompt-2.md](validation-prompt-2.md)

In addition, the conversion process now renders two ready-to-paste prompt files with the actual contents of your generated files already embedded:

- `*-validation-prompt-1.md`
- `*-validation-prompt-2.md`

### Step 2: Give the filtered source subset to an AI

Use `*-filtered-target-snps.csv` as the primary source file for validation. This is the safest input because it contains only the relevant original DNAEra lines, not the full raw export.

Also provide the list of 42 target SNPs above.

Ask the AI to work only from:

- the filtered DNAEra subset
- the 42 target SNP list

At this stage, do **not** give it the converted 23andMe file yet.

### Step 3: Ask the AI to recover the detectable target SNP subset

Ask the AI to classify each target SNP into one of these categories:

- directly detected
- detected after normalization or alias mapping
- present but not callable
- not recovered

You can start from the rendered `*-validation-prompt-1.md` file produced by the converter, or from the generic template [validation-prompt-1.md](validation-prompt-1.md).

### Step 4: Compare against the converted 23andMe-style file

Once the AI has recovered the subset of detectable target SNPs from the filtered DNAEra source rows, provide the second file:

- `*-converted-23andme.txt`

Then ask the AI to compare:

- the SNPs it recovered from the filtered DNAEra source subset
- against the SNPs present in the converted 23andMe-style output

You can continue with the rendered `*-validation-prompt-2.md` file produced by the converter, or from the generic template [validation-prompt-2.md](validation-prompt-2.md).

## What a good result looks like

A strong result looks like this:

- callable target SNPs recovered from the original DNAEra source subset are also present in the converted 23andMe-style output
- marker-level calls are concordant
- any differences are limited to:
  - uncallable rows
  - unrecovered loci
  - markers unsuitable for simple rsID output

## Example of a strong validation result

One example result from this process was:

> Final verdict
>
> Your converted file validates my earlier findings very well. On the actual called variants, it is a perfect match. The only changes are in how the converter handled markers that were uncallable or unsuitable for simple rsID output.

This is a good example of the kind of conclusion you want:

- strong agreement on callable variants
- limited differences
- explicit acknowledgment of edge cases

## Important cautions

- The converter is still best-effort.
- The AI should be given the exact 42-SNP target list, not a vague description.
- The AI should not infer markers that are not supported by the filtered source lines.
- `rs8175347` is a special case and should not be judged the same way as ordinary simple SNP calls.
- This validation method checks consistency of the implemented mapping process; it does not prove that DNAEra's hidden internal mapping is identical to the assumptions used here.

## Privacy note

If you want to minimize unnecessary disclosure:

- share `*-filtered-target-snps.csv` instead of the full DNAEra export
- share `*-converted-23andme.txt` only for the comparison step
- avoid publishing genotype values unless you explicitly want them included in the output
