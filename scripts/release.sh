#!/usr/bin/env bash

./scripts/package.sh
cd build/src
git init
git add .
git commit -am 'init commit'
git remote add origin git@github.com:nrwl/nx-build.git
git push -f origin master
