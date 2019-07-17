import { exec, execSync } from 'child_process';
import { readFileSync, statSync, writeFileSync, renameSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as path from 'path';

const projectName: string = 'proj';

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

function patchPackageJsonDeps() {
  const p = readFileSync('./tmp/proj/package.json').toString();
  const workspacePath = path.join(getCwd(), 'build', 'packages', 'workspace');
  const angularPath = path.join(getCwd(), 'build', 'packages', 'angular');
  writeFileSync(
    './tmp/proj/package.json',
    p
      .replace(
        '"@nrwl/workspace": "*"',
        `"@nrwl/workspace": "file:${workspacePath}"`
      )
      .replace('"@nrwl/angular": "*"', `"@nrwl/angular": "file:${angularPath}"`)
  );
}

function runYarnInstall(silent: boolean = true) {
  const install = execSync('yarn install', {
    cwd: './tmp/proj',
    ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
  });
  return install ? install.toString() : '';
}

export function runNgNew(command?: string, silent?: boolean): string {
  const gen = execSync(
    `../node_modules/.bin/ng new proj --no-interactive --skip-install ${command ||
      ''}`,
    {
      cwd: `./tmp`,
      ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
    }
  );
  patchPackageJsonDeps();
  const install = runYarnInstall(silent);
  return silent ? null : `${gen ? gen.toString() : ''}${install}`;
}

export function newProject(): void {
  cleanup();
  if (!directoryExists('./tmp/proj_backup')) {
    runNgNew('--collection=@nrwl/workspace --npmScope=proj', true);
    copyMissingPackages();

    writeFileSync(
      './tmp/proj/node_modules/@angular-devkit/schematics/tasks/node-package/executor.js',
      `
      "use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
function default_1(factoryOptions = {}) {
    return (options) => {
        return new rxjs_1.Observable(obs => {
          obs.complete();
        });
    };
}
exports.default = default_1;`
    );
    runCLI('add @nrwl/jest');
    runCLI('add @nrwl/cypress');
    runCLI('add @nrwl/web');
    runCLI('add @nrwl/react');
    runCLI('add @nrwl/angular');
    runCLI('add @nrwl/node');
    runCLI('add @nrwl/express');
    runCLI('add @nrwl/nest');
    execSync('mv ./tmp/proj ./tmp/proj_backup');
  }
  execSync('cp -a ./tmp/proj_backup ./tmp/proj');
}

export function ensureProject(): void {
  if (!directoryExists('./tmp/proj')) {
    newProject();
  }
}

export function runsInWSL() {
  return !!process.env['WINDOWSTMP'];
}

export function patchKarmaToWorkOnWSL(): void {
  try {
    const karma = readFile('karma.conf.js');
    if (process.env['WINDOWSTMP']) {
      updateFile(
        'karma.conf.js',
        karma.replace(
          `const { constants } = require('karma');`,
          `
      const { constants } = require('karma');
      process.env['TMPDIR']="${process.env['WINDOWSTMP']}";
    `
        )
      );
    }
  } catch (e) {}
}

export function copyMissingPackages(): void {
  const modulesToCopy = [
    '@ngrx',
    '@nrwl',
    'angular',
    '@angular',
    '@angular-devkit',
    'codelyzer',
    'ngrx-store-freeze',
    'npm-run-all',
    'yargs',
    'yargs-parser',

    'ng-packagr',
    'cypress',
    'jest',
    '@types/jest',
    'jest-preset-angular',
    'identity-obj-proxy',
    'karma',
    'karma-chrome-launcher',
    'karma-coverage-istanbul-reporter',
    'karma-jasmine',
    'karma-jasmine-html-reporter',
    'jasmine-core',
    'jasmine-spec-reporter',
    'jasmine-marbles',
    '@types/jasmine',
    '@types/jasminewd2',
    '@nestjs',
    'express',
    '@types/express',

    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
    '@testing-library',

    'document-register-element'
  ];
  modulesToCopy.forEach(m => copyNodeModule(projectName, m));
  updateFile(
    'node_modules/@angular-devkit/schematics/tasks/node-package/executor.js',
    `
    function default_1() {
      return () => {
        const rxjs = require("rxjs");
        return new rxjs.Observable(obs => {
          obs.next();
          obs.complete();
        });
      };
    }
    exports.default = default_1;
  `
  );

  execSync('rm -rf tmp/proj/node_modules/.bin/webpack');
  execSync(
    `cp -a node_modules/.bin/webpack tmp/proj/node_modules/.bin/webpack`
  );
  execSync(`rm -rf ./tmp/proj/node_modules/cypress/node_modules/@types`);
  execSync(`rm -rf ./tmp/proj/@types/sinon-chai/node_modules/@types`);
}

function copyNodeModule(path: string, name: string) {
  execSync(`rm -rf tmp/${path}/node_modules/${name}`);
  execSync(`cp -a node_modules/${name} tmp/${path}/node_modules/${name}`);
}

export function runCommandAsync(
  command: string,
  opts = {
    silenceError: false
  }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: `./tmp/proj`
      },
      (err, stdout, stderr) => {
        if (!opts.silenceError && err) {
          reject(err);
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

export function runCLIAsync(
  command: string,
  opts = {
    silenceError: false
  }
): Promise<{ stdout: string; stderr: string }> {
  return runCommandAsync(`./node_modules/.bin/ng ${command}`, opts);
}

export function runCLI(
  command?: string,
  opts = {
    silenceError: false
  }
): string {
  try {
    return execSync(`./node_modules/.bin/ng ${command}`, {
      cwd: `./tmp/${projectName}`
    })
      .toString()
      .replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
      );
  } catch (e) {
    if (opts.silenceError) {
      return e.stdout.toString();
    } else {
      console.log(e.stdout.toString(), e.stderr.toString());
      throw e;
    }
  }
}

export function expectTestsPass(v: { stdout: string; stderr: string }) {
  expect(v.stderr).toContain('Ran all test suites');
  expect(v.stderr).not.toContain('fail');
}

export function runCommand(command: string): string {
  try {
    return execSync(command, {
      cwd: `./tmp/${projectName}`,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
  } catch (e) {
    return e.stdout.toString() + e.stderr.toString();
  }
}

export function updateFile(f: string, content: string): void {
  ensureDirSync(path.dirname(path.join(getCwd(), 'tmp', 'proj', f)));
  writeFileSync(path.join(getCwd(), 'tmp', 'proj', f), content);
}

export function renameFile(f: string, newPath: string): void {
  ensureDirSync(path.dirname(path.join(getCwd(), 'tmp', 'proj', newPath)));
  renameSync(
    path.join(getCwd(), 'tmp', 'proj', f),
    path.join(getCwd(), 'tmp', 'proj', newPath)
  );
}

export function checkFilesExist(...expectedFiles: string[]) {
  expectedFiles.forEach(f => {
    const ff = f.startsWith('/')
      ? f
      : path.join(getCwd(), 'tmp', projectName, f);
    if (!exists(ff)) {
      throw new Error(`File '${ff}' does not exist`);
    }
  });
}

export function readJson(f: string): any {
  return JSON.parse(readFile(f));
}

export function readFile(f: string) {
  const ff = f.startsWith('/') ? f : path.join(getCwd(), 'tmp', projectName, f);
  return readFileSync(ff).toString();
}

export function cleanup() {
  execSync('rm -rf ./tmp/proj');
}

export function getCwd(): string {
  return process.cwd();
}

export function directoryExists(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch (err) {
    return false;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export function exists(filePath: string): boolean {
  return directoryExists(filePath) || fileExists(filePath);
}

export function getSize(filePath: string): number {
  return statSync(filePath).size;
}
