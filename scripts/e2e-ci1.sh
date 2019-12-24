#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

# Please keep this in alphabetical order
# This should be every file under e2e except for utils.js up to next.test.ts
export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/affected.test.js &&
jest --maxWorkers=1 ./build/e2e/bazel.test.js &&
jest --maxWorkers=1 ./build/e2e/command-line.test.js &&
jest --maxWorkers=1 ./build/e2e/cypress.test.js &&
jest --maxWorkers=1 ./build/e2e/delegate-to-cli.test.js &&
jest --maxWorkers=1 ./build/e2e/downgrade-module.test.js &&
jest --maxWorkers=1 ./build/e2e/help.test.js &&
jest --maxWorkers=1 ./build/e2e/jest.test.js &&
jest --maxWorkers=1 ./build/e2e/karma.test.js &&
jest --maxWorkers=1 ./build/e2e/list.test.js &&
jest --maxWorkers=1 ./build/e2e/migrate.test.js &&
jest --maxWorkers=1 ./build/e2e/move.angular.test.js &&
jest --maxWorkers=1 ./build/e2e/move.workspace.test.js &&
jest --maxWorkers=1 ./build/e2e/new.test.js &&
jest --maxWorkers=1 ./build/e2e/next.test.js
