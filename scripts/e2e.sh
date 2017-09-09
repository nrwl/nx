#!/usr/bin/env bash

./scripts/link.sh
rm -rf tmp
jest --maxWorkers=1 ./build/e2e/schematics/convert-to-workspace.test.js
