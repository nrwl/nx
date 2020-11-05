#!/usr/bin/env bash

set -e

echo "Generating API documentation"
ts-node -r tsconfig-paths/register --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-builders-data.ts
ts-node -r tsconfig-paths/register --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-schematics-data.ts
ts-node -r tsconfig-paths/register --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-cli-data.ts
echo 'Done generating all Documentation'
