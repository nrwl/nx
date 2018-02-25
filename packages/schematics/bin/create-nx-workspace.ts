#!/usr/bin/env node

import { execSync } from 'child_process';
import { dirSync } from 'tmp';
import { lt } from 'semver';
import { readFileSync, createReadStream, createWriteStream, writeFileSync } from 'fs';
import * as path from 'path';

const useYarn = process.argv.filter(p => p === '--yarn').length > 0;

if (!useYarn) {
  try {
    // check the correct version of the NPM is installed
    const output = execSync('npm --version').toString();
    if (lt(output, '5.0.0')) {
      console.error('To create a workspace you must have NPM >= 5.0.0 installed.');
      process.exit(1);
    }
  } catch (e) {
    console.error('Cannot find npm. If you want to use yarn to create a project, pass the --yarn flag.');
    process.exit(1);
  }
}

const projectName = process.argv.slice(2).filter(arg => !arg.startsWith('--'))[0];

// check that the workspace name is passed in
if (!projectName) {
  console.error('Please provide a project name (e.g., create-nx-workspace nrwl-proj)');
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
      '@angular/cli': '1.7.1'
    },
    license: 'MIT'
  })
);

if (useYarn) {
  execSync('yarn install --silent', { cwd: tmpDir, stdio: [0, 1, 2] });
} else {
  execSync('npm install --silent', { cwd: tmpDir, stdio: [0, 1, 2] });
}

// creating the app itself
const args = process.argv
  .slice(2)
  .filter(a => a !== '--yarn')
  .map(a => `"${a}"`)
  .join(' ');
console.log(`ng new ${args} --collection=@nrwl/schematics`);
execSync(
  `${path.join(tmpDir, 'node_modules', '.bin', 'ng')} new ${args} --skip-install --collection=@nrwl/schematics`,
  {
    stdio: [0, 1, 2]
  }
);

if (useYarn) {
  execSync(`yarn install`, { stdio: [0, 1, 2], cwd: projectName });
} else {
  execSync(`npm install`, { stdio: [0, 1, 2], cwd: projectName });
}
