#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

# Please keep this in alphabetical order
# This should be every file under e2e except for utils.js up to next.test.ts
export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/new.test.js &&
jest --maxWorkers=1 ./build/e2e/affected.test.js &&
jest --maxWorkers=1 ./build/e2e/affected-git.test.js &&
# jest --maxWorkers=1 ./build/e2e/bazel.test.js &&
jest --maxWorkers=1 ./build/e2e/command-line.test.js &&
jest --maxWorkers=1 ./build/e2e/cypress.test.js
