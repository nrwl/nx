#!/usr/bin/env node

import { execSync } from 'child_process';
import { dirSync } from 'tmp';
import { writeFileSync } from 'fs';
import * as path from 'path';
import * as yargsParser from 'yargs-parser';

const parsedArgs = yargsParser(process.argv, {
  string: ['directory'],
  boolean: ['help']
});

if (parsedArgs.help) {
  console.log(`
    Usage: create-nx-workspace <directory> [options] [ng new options]

    Create a new Nx workspace

    Options:

      directory             path to the workspace root directory

      [ng new options]      any 'ng new' options
                            run 'ng new --help' for more information
  `);
  process.exit(0);
}

const nxTool = {
  name: 'Schematics',
  packageName: '@nrwl/schematics'
};
let useYarn = true;

try {
  execSync('yarn --version', { stdio: ['ignore', 'ignore', 'ignore'] });
} catch (e) {
  useYarn = false;
}

const projectName = parsedArgs._[2];

// check that the workspace name is passed in
if (!projectName) {
  console.error(
    'Please provide a project name (e.g., create-nx-workspace nrwl-proj)'
  );
  process.exit(1);
}

// creating the sandbox
console.log(`Creating a sandbox with Nx...`);
const tmpDir = dirSync().name;

const nxVersion = 'NX_VERSION';
const cliVersion = 'ANGULAR_CLI_VERSION';

writeFileSync(
  path.join(tmpDir, 'package.json'),
  JSON.stringify({
    dependencies: {
      [nxTool.packageName]: nxVersion,
      '@angular/cli': cliVersion
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
  .map(a => `"${a}"`)
  .join(' ');
console.log(`ng new ${args} --collection=${nxTool.packageName}`);
execSync(
  `${path.join(
    tmpDir,
    'node_modules',
    '.bin',
    'ng'
  )} new ${args} --collection=${nxTool.packageName}`,
  {
    stdio: [0, 1, 2]
  }
);
