#!/usr/bin/env bash

./scripts/package.sh

cd build/packages/bazel
git init
git add .
git commit -am 'init commit'
git remote add origin git@github.com:nrwl/bazel-build.git
git push -f origin master

cd ../nx
git init
git add .
git commit -am 'init commit'
git remote add origin git@github.com:nrwl/nx-build.git
git push -f origin master

cd ../schematics
git init
git add .
git commit -am 'init commit'
git remote add origin git@github.com:nrwl/schematics-build.git
git push -f origin master
