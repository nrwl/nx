#!/usr/bin/env bash

./scripts/link.sh 9999.0.0

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$1
PUBLISHED_VERSION=9999.0.0 NPM_CONFIG_REGISTRY=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 "./build/e2e/(jest|karma|next|nx-plugin|downgrade-module).test.js"
