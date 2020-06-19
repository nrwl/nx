#!/usr/bin/env bash
export SELECTED_CLI=$SELECTED_CLI
ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts "$@"
