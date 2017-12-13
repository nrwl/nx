#!/bin/bash

rm -rf build
ngc
rsync -a --exclude=*.ts packages/ build/packages
rm -rf build/packages/install
cp README.md build/packages/schematics
cp README.md build/packages/nx