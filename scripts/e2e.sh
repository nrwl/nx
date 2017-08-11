#!/usr/bin/env bash

rm -rf node_modules/@nrwl
mkdir -p node_modules/@nrwl
cp -r build/src node_modules/@nrwl/ext
cp package.json node_modules/@nrwl/ext/package.json

rm -rf tmp
jest --maxWorkers=1 ./build/e2e
