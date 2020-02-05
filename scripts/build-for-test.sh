#!/usr/bin/env bash

rm -rf build
./node_modules/.bin/tsc
rsync -a --exclude=*.ts packages/ build/packages