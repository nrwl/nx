#!/usr/bin/env bash

npx ng-packagr -p packages/nx/ng-package.json

rm -rf build
./node_modules/.bin/ngc

#Nx client side lib
rm -rf build/packages/nx
cp -r packages/nx/dist build/packages/nx
rm -rf packages/nx/dist

#TODO This is a temporary hack until we can publish named umds
sed -i.bak "s/define(\[/define('@nrwl\/nx',\[/" build/packages/nx/bundles/nrwl-nx.umd.js
sed -i.bak "s/define(\[/define('@nrwl\/nx',\[/" build/packages/nx/bundles/nrwl-nx.umd.min.js

rm -rf build/packages/nx/bundles/nrwl-nx.umd.js.bak
rm -rf build/packages/nx/bundles/nrwl-nx.umd.min.js.bak

sed -i.bak "s/define(\[/define('@nrwl\/nx\/testing',\[/" build/packages/nx/bundles/nrwl-nx-testing.umd.js
sed -i.bak "s/define(\[/define('@nrwl\/nx\/testing',\[/" build/packages/nx/bundles/nrwl-nx-testing.umd.min.js

rm -rf build/packages/nx/bundles/nrwl-nx-testing.umd.js.bak
rm -rf build/packages/nx/bundles/nrwl-nx-testing.umd.min.js.bak

rsync -a --exclude=*.ts packages/ build/packages

chmod +x build/packages/schematics/bin/create-nx-workspace.js
chmod +x build/packages/schematics/src/command-line/nx.js
rm -rf build/packages/install
rm -rf build/packages/nx/dist
rm -rf build/packages/nx/spec
cp README.md build/packages/builders
cp README.md build/packages/schematics
cp README.md build/packages/nx
cp LICENSE build/packages/bazel
cp LICENSE build/packages/builders
cp LICENSE build/packages/schematics
cp LICENSE build/packages/nx

echo "Nx libraries available at build/packages:"
ls build/packages