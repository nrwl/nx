#!/usr/bin/env bash

./scripts/build.sh

rm -rf node_modules/@nrwl
cp -r build/packages node_modules/@nrwl

rm -rf test/

tsc -p tsconfig.spec.json

rsync -a --exclude=*.ts packages/ test/packages

rm -rf node_modules/@nrwl
cp -r build/packages node_modules/@nrwl