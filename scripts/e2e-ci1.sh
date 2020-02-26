#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/new.test.js &&
jest --maxWorkers=1 ./build/e2e/affected.test.js &&
jest --maxWorkers=1 ./build/e2e/affected-git.test.js &&
jest --maxWorkers=1 ./build/e2e/command-line.test.js &&
jest --maxWorkers=1 ./build/e2e/cypress.test.js
