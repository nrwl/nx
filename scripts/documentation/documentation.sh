#!/usr/bin/env bash

echo "Generating API documentation"
ts-node ./scripts/documentation/builders.ts
ts-node ./scripts/documentation/npmscripts.ts
ts-node ./scripts/documentation/schematics.ts
