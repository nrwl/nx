const childProcess = require('child_process');
const fs = require('fs-extra');

childProcess.execSync(`npx ng-packagr -p packages/angular/ng-package.json`, {
  stdio: [0, 1, 2],
});
fs.copySync('packages/angular/dist/', 'build/packages/angular/');
fs.removeSync('packages/angular/dist/');
