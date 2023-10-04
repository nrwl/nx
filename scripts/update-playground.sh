#!/usr/bin/env bash

./scripts/build.sh

echo 'Updating all playground projects...'

# Update NX playground
rm -rf tmp/nx/proj/node_modules/@nrwl
cp -r build/packages tmp/nx/proj/node_modules/@nrwl

# Update Angular playground
rm -rf tmp/angular/proj/node_modules/@nrwl
cp -r build/packages tmp/angular/proj/node_modules/@nrwl
