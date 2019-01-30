#!/usr/bin/env bash

echo "Generating API documentation"
ts-node ./scripts/documentation/builders.ts
ts-node ./scripts/documentation/commands.ts
ts-node ./scripts/documentation/schematics.ts