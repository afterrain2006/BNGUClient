#!/usr/bin/env bash
# Requires Node/npm, stable Rust and the Tauri system dependencies documented
# in docs/installation-and-usage.md. Does not install AI or modify the system.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
npm ci --no-audit --no-fund
npm run check
npm run build:desktop
echo "BNGUClient built. Default output: src-tauri/target/release/BNGUClient"
