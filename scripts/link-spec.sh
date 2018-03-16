#!/usr/bin/env bash
rm -rf build/

tsc

rsync -a --exclude=*.ts packages/ build/packages

rm -rf node_modules/@nrwl
cp -r build/packages node_modules/@nrwl
