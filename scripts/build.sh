#!/bin/bash

rm -rf build
ngc
rsync -a --exclude=*.ts packages/ build/packages
cp README.md build/packages/schematics
cp README.md build/packages/nx
cp README.md build/packages/bazel
