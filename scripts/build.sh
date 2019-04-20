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

chmod +x build/packages/workspace/bin/create-nx-workspace.js
chmod +x build/packages/create-nx-workspace/bin/create-nx-workspace.js
chmod +x build/packages/workspace/src/command-line/nx.js
rm -rf build/packages/install
rm -rf build/packages/nx/dist
rm -rf build/packages/nx/spec
cp README.md build/packages/builders
cp README.md build/packages/schematics
cp README.md build/packages/nx
cp README.md build/packages/create-nx-workspace
cp README.md build/packages/workspace
cp README.md build/packages/node
cp README.md build/packages/express
cp README.md build/packages/nest
cp README.md build/packages/web
cp README.md build/packages/react
cp README.md build/packages/angular
cp README.md build/packages/jest
cp README.md build/packages/cypress
cp LICENSE build/packages/builders
cp LICENSE build/packages/schematics
cp LICENSE build/packages/nx
cp LICENSE build/packages/create-nx-workspace
cp LICENSE build/packages/workspace
cp LICENSE build/packages/node
cp LICENSE build/packages/express
cp LICENSE build/packages/nest
cp LICENSE build/packages/web
cp LICENSE build/packages/react
cp LICENSE build/packages/angular
cp LICENSE build/packages/jest
cp LICENSE build/packages/cypress

echo "Nx libraries available at build/packages:"
ls build/packages
