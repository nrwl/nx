#!/usr/bin/env bash

./scripts/link.sh 9999.0.0

rm -rf tmp/nx/proj/node_modules/@nrwl
rm -rf tmp/angular/proj/node_modules/@nrwl
cp -r node_modules/@nrwl tmp/nx/proj/node_modules/@nrwl
cp -r node_modules/@nrwl tmp/angular/proj/node_modules/@nrwl

if [ -n "$1" ]; then
  PUBLISHED_VERSION=9999.0.0 NPM_CONFIG_REGISTRY=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 ./build/e2e/$1.test.js
else
  PUBLISHED_VERSION=9999.0.0 NPM_CONFIG_REGISTRY=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 ./build/e2e
fi


