#!/usr/bin/env bash
if [ "$1" == "1" ]; then
  export SELECTED_CLI=angular
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-workspace,e2e-cli affected

elif [ "$1" == "2" ]; then
  export SELECTED_CLI=nx
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-workspace,e2e-cli affected

elif [ "$1" == "3" ]; then
  export SELECTED_CLI=angular
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-angular,e2e-bazel affected

elif [ "$1" == "4" ]; then
  export SELECTED_CLI=nx
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-cypress,e2e-jest,e2e-nx-plugin affected

elif [ "$1" == "5" ]; then
  export SELECTED_CLI=nx
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-react affected

elif [ "$1" == "6" ]; then
  export SELECTED_CLI=nx
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-next affected

elif [ "$1" == "7" ]; then
  export SELECTED_CLI=nx
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-node affected

elif [ "$1" == "8" ]; then
  export SELECTED_CLI=nx
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-web,e2e-linter,e2e-storybook affected
fi
