#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash conversion.sh /path/to/DNAEra-export.csv" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_PATH="$1"

if [[ ! -f "${INPUT_PATH}" ]]; then
  echo "Input file not found: ${INPUT_PATH}" >&2
  exit 1
fi

INPUT_DIR="$(cd "$(dirname "${INPUT_PATH}")" && pwd)"
INPUT_NAME="$(basename "${INPUT_PATH}")"
INPUT_STEM="${INPUT_NAME%.*}"
if [[ "${INPUT_STEM}" == "${INPUT_NAME}" ]]; then
  INPUT_STEM="${INPUT_NAME}"
fi

OUTPUT_PATH="${INPUT_DIR}/${INPUT_STEM}-converted-23andme.txt"

node "${SCRIPT_DIR}/convert-dnaera.js" "${INPUT_PATH}" "${OUTPUT_PATH}"

echo "Created: ${OUTPUT_PATH}"
