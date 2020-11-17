#!/usr/bin/env bash
./scripts/link.sh 9999.0.2

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

PUBLISHED_VERSION=9999.0.2 npm_config_registry=http://localhost:4872/ jest --maxWorkers=1  -c "./build/e2e/jest-config.js" ./build/e2e/commands/create-playground.test.js
