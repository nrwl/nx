#!/usr/bin/env bash

cp package.json build/src/package.json
cp README.md build/src/README.md
cp LICENSE build/src/LICENSE
cd build/src
git init
git add .
git commit -am 'init commit'
git remote add origin git@github.com:nrwl/nx-build.git
git push -f origin master
