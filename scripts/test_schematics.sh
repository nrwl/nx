#!/usr/bin/env bash

if [ -n "$1" ]; then
  jest --maxWorkers=1 ./test/packages/$1.spec.js
else
  jest --maxWorkers=1 ./test/packages/{schematics,bazel}
fi
