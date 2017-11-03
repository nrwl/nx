#!/usr/bin/env bash

rm -rf ./node_modules/clis
mkdir ./node_modules/clis
# rm -rf ./node_modules/@angular/cli/node_modules
cp -rf ./node_modules/@angular/cli ./node_modules/clis/standard
# cp -rf ./node_modules/bazel-cli ./node_modules/clis/bazel
