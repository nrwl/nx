#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

# Please keep this in alphabetical order
# This should be every file under e2e except for utils.js after ng-add.test.ts
export SELECTED_CLI=$1
jest --maxWorkers=1 ./build/e2e/run-many.test.js &&
jest --maxWorkers=1 ./build/e2e/storybook.test.js &&
jest --maxWorkers=1 ./build/e2e/upgrade-module.test.js &&
jest --maxWorkers=1 ./build/e2e/web.test.js &&
jest --maxWorkers=1 ./build/e2e/tasks-runner-v2.test.js &&
jest --maxWorkers=1 ./build/e2e/angular-package.test.js &&
jest --maxWorkers=1 ./build/e2e/react-package.test.js &&
jest --maxWorkers=1 ./build/e2e/ngrx.test.js
