#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/jest.test.js &&
jest --maxWorkers=1 ./build/e2e/karma.test.js &&
jest --maxWorkers=1 ./build/e2e/next.test.js &&
jest --maxWorkers=1 ./build/e2e/nx-plugin.test.js &&
jest --maxWorkers=1 ./build/e2e/downgrade-module.test.js
