#!/usr/bin/env bash
if [ "$1" == "1" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-workspace affected

elif [ "$1" == "2" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-cli,e2e-nx-plugin affected

elif [ "$1" == "3" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-cypress,e2e-jest affected

elif [ "$1" == "4" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-react affected

elif [ "$1" == "5" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-next affected

elif [ "$1" == "6" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-node affected

elif [ "$1" == "7" ]; then
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-web,e2e-linter,e2e-storybook affected

elif [ "$1" == "8" ]; then
  export SELECTED_CLI=angular
  ts-node --project scripts/tsconfig.e2e.json ./scripts/e2e.ts e2e-angular affected
fi
