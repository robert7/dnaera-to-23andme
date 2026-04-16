# Validation Prompt 2

Use this prompt with an AI model for the second validation step.

Replace:

- `{{CONVERTED_23ANDME_FILE}}` with your actual `*-converted-23andme.txt` file

---

Now compare the recovered callable target SNP subset from step 1 against the converted 23andMe-style file `{{CONVERTED_23ANDME_FILE}}`.

Use:

- your conclusions from the previous step based on the filtered DNAEra source subset
- the converted 23andMe-style file

Do **not** infer loci outside the curated target set.
Do **not** provide medical interpretation.
Do **not** disclose personal genotype values in the summary unless explicitly asked.

Please check:

- whether the same callable target loci are present in the converted file
- whether the calls are concordant at the marker level
- whether any differences are explained by no-calls, normalization limits, repeat-polymorphism handling, or markers unsuitable for simple rsID output

Special note:

- `rs8175347` should be treated as a special case and should not be judged by the same standard as ordinary simple SNP calls

Please return:

1. A comparison summary with:
   - callable target SNPs recovered from the filtered DNAEra subset
   - how many of those are present in the converted file
   - how many are concordant
   - how many differ

2. A short list of any discrepancies
   For each discrepancy, explain whether it appears to be:
   - a likely conversion problem
   - an acceptable no-call / unsupported-marker case
   - a special-case marker issue

3. A final verdict in plain language
   Example style:
   - very strong match
   - good match with a few explainable exceptions
   - mixed result requiring manual review
