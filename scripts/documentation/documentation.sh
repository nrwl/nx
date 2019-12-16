#!/usr/bin/env bash

set -e

echo "Generating API documentation"
ts-node ./scripts/documentation/generate-builders-data.ts
ts-node ./scripts/documentation/generate-schematics-data.ts
ts-node ./scripts/documentation/generate-npmscripts-data.ts
echo 'Done generating all Documentation'
