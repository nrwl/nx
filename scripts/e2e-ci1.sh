#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/angular.test.js &&
jest --maxWorkers=1 ./build/e2e/cli.test.js &&
jest --maxWorkers=1 ./build/e2e/workspace.test.js &&
jest --maxWorkers=1 ./build/e2e/workspace-aux-commands.test.js &&
jest --maxWorkers=1 ./build/e2e/cypress.test.js
