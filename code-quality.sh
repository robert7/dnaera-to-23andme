#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${ROOT_DIR}"

echo "[code-quality] Running test suite"
npm test

echo "[code-quality] Running coverage checks"
npm run test:coverage
