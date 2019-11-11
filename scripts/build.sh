#!/usr/bin/env bash
rm -rf build

npx ng-packagr -p packages/angular/ng-package.json

#Nx client side lib
rm -rf packages/angular/dist/src
mkdir build
mkdir build/packages
cp -r packages/angular/dist build/packages/angular
rm -rf packages/angular/dist

echo "Compiling Typescript..."
./node_modules/.bin/tsc
echo "Compiled Typescript"

#TODO This is a temporary hack until we can publish named umds
sed -i.bak "s/define(\[/define('@nrwl\/angular',\[/" build/packages/angular/bundles/nrwl-angular.umd.js
sed -i.bak "s/define(\[/define('@nrwl\/angular',\[/" build/packages/angular/bundles/nrwl-angular.umd.min.js

rm -rf build/packages/angular/bundles/nrwl-angular.umd.js.bak
rm -rf build/packages/angular/bundles/nrwl-angular.umd.min.js.bak

sed -i.bak "s/define(\[/define('@nrwl\/angular\/testing',\[/" build/packages/angular/bundles/nrwl-angular-testing.umd.js
sed -i.bak "s/define(\[/define('@nrwl\/angular\/testing',\[/" build/packages/angular/bundles/nrwl-angular-testing.umd.min.js

rm -rf build/packages/angular/bundles/nrwl-angular-testing.umd.js.bak
rm -rf build/packages/angular/bundles/nrwl-angular-testing.umd.min.js.bak

rsync -a --exclude=*.ts packages/ build/packages
chmod +x build/packages/create-nx-workspace/bin/create-nx-workspace.js
chmod +x build/packages/cli/bin/nx.js
chmod +x build/packages/tao/index.js

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
cp README.md build/packages/next
cp README.md build/packages/angular
cp README.md build/packages/jest
cp README.md build/packages/cypress
cp README.md build/packages/storybook
cp README.md build/packages/cli
cp README.md build/packages/tao
cp README.md build/packages/eslint-plugin-nx
cp README.md build/packages/linter

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
cp LICENSE build/packages/next
cp LICENSE build/packages/angular
cp LICENSE build/packages/jest
cp LICENSE build/packages/cypress
cp LICENSE build/packages/storybook
cp LICENSE build/packages/cli
cp LICENSE build/packages/tao
cp LICENSE build/packages/eslint-plugin-nx
cp LICENSE build/packages/linter

echo "Nx libraries available at build/packages:"
ls build/packages
