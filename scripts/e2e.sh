#!/usr/bin/env bash
./scripts/package.sh 9999.0.1 "~9.1.0" "3.8.3" "2.0.4"

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

export SELECTED_CLI=$SELECTED_CLI
if [ -n "$1" ]; then
  TEST_FILE="./build/e2e/$1.test.js"
  COMMAND_FILE="./build/e2e/commands/$1.test.js"
  if [ -f "$TEST_FILE" ]; then
    PUBLISHED_VERSION=9999.0.1 npm_config_registry=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 $TEST_FILE
  else
    PUBLISHED_VERSION=9999.0.1 npm_config_registry=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 $COMMAND_FILE
  fi
else
  PUBLISHED_VERSION=9999.0.1 npm_config_registry=http://localhost:4872/ jest -c "./build/e2e/jest-config.js" --maxWorkers=1 ./build/e2e/*.test.js
fi
