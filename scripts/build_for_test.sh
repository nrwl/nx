#!/usr/bin/env bash

rm -rf build
./node_modules/.bin/ngc
rsync -a --exclude=*.ts packages/ build/packages