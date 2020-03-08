#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/run-many.test.js &&
jest --maxWorkers=1 ./build/e2e/storybook.test.js &&
jest --maxWorkers=1 ./build/e2e/upgrade-module.test.js &&
jest --maxWorkers=1 ./build/e2e/web.test.js &&
jest --maxWorkers=1 ./build/e2e/cache.test.js &&
jest --maxWorkers=1 ./build/e2e/buildable-libraries.test.js &&
jest --maxWorkers=1 ./build/e2e/angular-package.test.js &&
jest --maxWorkers=1 ./build/e2e/react-package.test.js &&
jest --maxWorkers=1 ./build/e2e/ngrx.test.js
