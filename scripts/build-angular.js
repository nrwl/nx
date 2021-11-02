const childProcess = require('child_process');
const fs = require('fs-extra');

childProcess.execSync(`npx ng-packagr -p packages/angular/ng-package.json`, {
  stdio: [0, 1, 2],
});
fs.removeSync('packages/angular/dist/src');
fs.copySync('packages/angular/dist/', 'build/packages/angular/');
fs.removeSync('packages/angular/dist/');
