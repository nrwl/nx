#!/usr/bin/env bash

./scripts/build.sh

rm -rf node_modules/@nrwl
cp -r build/packages node_modules/@nrwl
