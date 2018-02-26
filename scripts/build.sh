#!/bin/bash

rm -rf build
./node_modules/.bin/ngc
rsync -a --exclude=*.ts packages/ build/packages
chmod +x build/packages/schematics/bin/create-nx-workspace.js
chmod +x build/packages/schematics/src/command-line/nx.js
rm -rf build/packages/install
cp README.md build/packages/schematics
cp README.md build/packages/nx