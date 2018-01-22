#!/usr/bin/env node

import { execSync } from 'child_process';
import { dirSync } from 'tmp';
import { lt } from 'semver';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

// check the correct version of the NPM is installed
const output = execSync('npm --version').toString();
if (lt(output, '5.0.0')) {
  console.log('To create a workspace you must have NPM >= 5.0.0 installed.');
  process.exit(1);
}

// check that the workspace name is passed in
if (process.argv.length < 3) {
  console.error('Please provide a project name (e.g., create-nx-workspace nrwl-proj');
  process.exit(1);
}

// creating the sandbox
console.log('Creating a sandbox with the CLI and Nx Schematics...');
const tmpDir = dirSync().name;
const nxVersion = JSON.parse(readFileSync(path.join(path.dirname(__dirname), 'package.json'), 'UTF-8')).version;
writeFileSync(
  path.join(tmpDir, 'package.json'),
  JSON.stringify({
    dependencies: {
      '@nrwl/schematics': nxVersion,
      '@angular/cli': `file:${path.join(
        path.dirname(__dirname),
        'src',
        'collection',
        'application',
        'files',
        '__directory__',
        '.angular_cli.tgz'
      )}`,
      '@angular-devkit/core': '^0.0.28'
    }
  })
);

execSync('npm install --silent', { cwd: tmpDir, stdio: [0, 1, 2] });

// creating the app itself
const args = process.argv
  .slice(2)
  .map(a => `"${a}"`)
  .join(' ');
console.log(`ng new ${args} --collection=@nrwl/schematics`);
execSync(`${path.join(tmpDir, 'node_modules', '.bin', 'ng')} new ${args} --collection=@nrwl/schematics`, {
  stdio: [0, 1, 2]
});
