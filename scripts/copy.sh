#!/usr/bin/env bash

./scripts/build.sh


path=${PWD}
echo $path
sed -i "" "s|nrwl/bazel-build|file:$1/node_modules/@nrwl/bazel|g" build/packages/bazel/src/workspace/files/package.json__tmpl__
sed -i "" "s|nrwl/schematics-build|file:$1/node_modules/@nrwl/schematics|g" build/packages/bazel/src/workspace/files/package.json__tmpl__

rm -rf $1/node_modules/@nrwl
cp -r build/packages $1/node_modules/@nrwl
