#!/usr/bin/env bash
npx ng-packagr -p packages/angular/ng-package.json
rm -rf packages/angular/dist/src
cp -r packages/angular/dist/* build/packages/angular/
rm -rf packages/angular/dist

#TODO This is a temporary hack until we can publish named umds
sed -i.bak "s/define(\[/define('@nrwl\/angular',\[/" build/packages/angular/bundles/nrwl-angular.umd.js
sed -i.bak "s/define(\[/define('@nrwl\/angular',\[/" build/packages/angular/bundles/nrwl-angular.umd.min.js

rm -rf build/packages/angular/bundles/nrwl-angular.umd.js.bak
rm -rf build/packages/angular/bundles/nrwl-angular.umd.min.js.bak

sed -i.bak "s/define(\[/define('@nrwl\/angular\/testing',\[/" build/packages/angular/bundles/nrwl-angular-testing.umd.js
sed -i.bak "s/define(\[/define('@nrwl\/angular\/testing',\[/" build/packages/angular/bundles/nrwl-angular-testing.umd.min.js

rm -rf build/packages/angular/bundles/nrwl-angular-testing.umd.js.bak
rm -rf build/packages/angular/bundles/nrwl-angular-testing.umd.min.js.bak
