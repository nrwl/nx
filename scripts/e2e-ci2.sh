#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

# Please keep this in alphabetical order
# This should be every file under e2e except for utils.js after ng-add.test.ts
export SELECTED_CLI=$1
