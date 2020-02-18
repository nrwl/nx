#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

if [ -n "$1" ]; then
  TEST_FILE="./build/e2e/$1.test.js"
  COMMAND_FILE="./build/e2e/commands/$1.test.js"

  if [ -f "$TEST_FILE" ]; then
    jest --maxWorkers=1 $TEST_FILE
  else
    jest --maxWorkers=1 $COMMAND_FILE
  fi
else
  jest --maxWorkers=1 ./build/e2e/*.test.js
fi
