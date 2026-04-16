# AGENTS.md

This repository contains a standalone compatibility converter for turning DNAEra raw exports into 23andMe-style text files, primarily so the getbased app can import them without code changes.

## Working Rules

- Keep the project standalone and dependency-light. Prefer built-in Node.js modules over adding packages.
- Preserve the current honesty boundary: this repo is a best-effort bridge, not a vendor-certified full-genome transcode.
- Do not claim that generic public Illumina GSA files are identical to DNAEra's exact custom manifest unless new evidence supports that claim.
- If you change mapping behavior or supported coverage, update `README.md` and the tests in the same change.
- Keep the output format compatible with 23andMe-style import expectations:
  - comment lines first
  - then `rsid	chromosome	position	genotype`
- If DNAEra provides an official manifest or mapping table later, prefer that over the current fallback strategy and document the switch clearly.

## Commands

- `npm test` - run the test suite
- `npm run test:coverage` - run the test suite with coverage thresholds

## Coverage Policy

- Minimum coverage is enforced at `85%` for lines, functions, and branches on `convert-dnaera.js`.
- New logic should come with tests; do not lower thresholds to make the test suite pass.
