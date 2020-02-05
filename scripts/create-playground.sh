#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

jest --maxWorkers=1 ./build/e2e/commands/create-playground.test.js


