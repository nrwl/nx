#!/usr/bin/env bash

set -e

echo "Generating API documentation"
ts-node --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-builders-data.ts
ts-node --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-schematics-data.ts
ts-node --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-cli-data.ts
echo 'Done generating all Documentation'
