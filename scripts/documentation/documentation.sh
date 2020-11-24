#!/usr/bin/env bash

set -e

echo "Generating API documentation"
ts-node -r tsconfig-paths/register --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-executors-data.ts
ts-node -r tsconfig-paths/register --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-generators-data.ts
ts-node -r tsconfig-paths/register --project=scripts/tsconfig.scripts.json ./scripts/documentation/generate-cli-data.ts
echo 'Done generating all Documentation'
