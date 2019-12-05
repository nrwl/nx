#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp/nx/proj/node_modules/@nrwl
rm -rf tmp/angular/proj/node_modules/@nrwl
cp -r node_modules/@nrwl tmp/nx/proj/node_modules/@nrwl
cp -r node_modules/@nrwl tmp/angular/proj/node_modules/@nrwl

if [ -n "$1" ]; then
  jest --maxWorkers=1 ./build/e2e/$1.test.js
else
  jest --maxWorkers=1 ./build/e2e
fi


