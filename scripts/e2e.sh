#!/usr/bin/env bash

./scripts/link.sh

rm -rf tmp
mkdir -p tmp/angular
mkdir -p tmp/nx

if test "$1" == "--cli"; then
  export SELECTED_CLI=$2  
  jest --maxWorkers=1 ./build/e2e/*.test.js
elif [ -n "$1" ]; then
  jest --maxWorkers=1 ./build/e2e/$1.test.js
else
  jest --maxWorkers=1 ./build/e2e/*.test.js
fi


