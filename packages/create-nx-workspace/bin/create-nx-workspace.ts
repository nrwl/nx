#!/usr/bin/env node

// we can import from '@nrwl/workspace' because it will require typescript
import { output } from '@nrwl/workspace/src/command-line/output';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as path from 'path';
import { dirSync } from 'tmp';
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
  packageName: '@nrwl/workspace'
};

let packageManager: string;
try {
  packageManager = execSync('ng config -g cli.packageManager', {
    stdio: ['ignore', 'pipe', 'ignore']
  })
    .toString()
    .trim();
} catch (e) {
  packageManager = 'yarn';
}
try {
  execSync(`${packageManager} --version`, {
    stdio: ['ignore', 'ignore', 'ignore']
  });
} catch (e) {
  packageManager = 'npm';
}

const projectName = parsedArgs._[2];

// check that the workspace name is passed in
if (!projectName) {
  output.error({
    title: 'A project name is required when creating a new workspace',
    bodyLines: [
      output.colors.gray('For example:'),
      '',
      `${output.colors.gray('>')} create-nx-workspace my-new-workspace`
    ]
  });
  process.exit(1);
}

// creating the sandbox
output.logSingleLine(`Creating a sandbox...`);
const tmpDir = dirSync().name;

const nxVersion = 'NX_VERSION';
const cliVersion = 'ANGULAR_CLI_VERSION';
const typescriptVersion = 'TYPESCRIPT_VERSION';

writeFileSync(
  path.join(tmpDir, 'package.json'),
  JSON.stringify({
    dependencies: {
      [nxTool.packageName]: nxVersion,
      '@angular/cli': cliVersion,
      typescript: typescriptVersion
    },
    license: 'MIT'
  })
);

execSync(`${packageManager} install --silent`, {
  cwd: tmpDir,
  stdio: [0, 1, 2]
});

// creating the app itself
const args = process.argv
  .slice(2)
  .map(a => `"${a}"`)
  .join(' ');

output.logSingleLine(
  `${output.colors.gray('Running:')} ng new ${args} --collection=${
    nxTool.packageName
  }`
);

execSync(
  `"${path.join(
    tmpDir,
    'node_modules',
    '.bin',
    'ng'
  )}" new ${args} --collection=${nxTool.packageName}`,
  {
    stdio: [0, 1, 2]
  }
);

// TODO: vsavkin: reenable for 8.4
// try {
//   execSync('nx --version');
// } catch (e) {
//   // no nx found
//   console.log('-----------------------------------------------------------');
//   console.log(`It looks like you don't have the Nx CLI installed globally.`);
//   console.log(
//     `This means that you might have to use "yarn nx" or "npm nx" to execute commands in your workspace.`
//   );
//   console.log(
//     `If you want to execute the nx command directly, run "yarn global add @nrwl/cli" or "npm install -g @nrwl/cli"`
//   );
//   console.log('-----------------------------------------------------------');
// }
