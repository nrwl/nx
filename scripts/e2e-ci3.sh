#!/usr/bin/env bash
./scripts/package.sh 9999.0.1 "~9.1.0" "3.8.3" "2.0.4"

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$1
PUBLISHED_VERSION=9999.0.1 npm_config_registry=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 "./build/e2e/(web|angular-package|react-package|node).test.js"
