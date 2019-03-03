import { exec, execSync } from 'child_process';
import { readFileSync, statSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as path from 'path';

const projectName: string = 'proj';

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

export function runNgNew(command?: string, silent?: boolean): string {
  const buffer = execSync(
    `../node_modules/.bin/ng new proj --no-interactive ${command}`,
    {
      cwd: `./tmp`,
      ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
    }
  );
  return buffer ? buffer.toString() : null;
}

export function newProject(): void {
  cleanup();
  if (!directoryExists('./tmp/proj_backup')) {
    runNgNew('--collection=@nrwl/schematics --npmScope=proj', true);
    copyMissingPackages();
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
    '@angular/upgrade',
    '@angular-devkit/build-ng-packagr',
    'codelyzer',
    'ngrx-store-freeze',
    'npm-run-all',
    'yargs',
    'yargs-parser',

    'cypress',
    '@types/jquery',
    'jest',
    '@types/jest',
    'jest-preset-angular',
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
    'react-testing-library',

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

export function newApp(name: string): string {
  const r = runCLI(`generate app --no-interactive ${name}`);
  patchKarmaToWorkOnWSL();
  return r;
}

export function newLib(name: string): string {
  const r = runCLI(`generate lib --no-interactive ${name}`);
  patchKarmaToWorkOnWSL();
  return r;
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
