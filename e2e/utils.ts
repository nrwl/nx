import { exec, execSync } from 'child_process';
import { readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as path from 'path';

export let cli;

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

export function forEachCli(
  selectedCliOrFunction: string | Function,
  callback?: (currentCLIName) => void
) {
  let clis;
  if (process.env.SELECTED_CLI && selectedCliOrFunction && callback) {
    if (selectedCliOrFunction == process.env.SELECTED_CLI) {
      clis = [process.env.SELECTED_CLI];
    } else {
      clis = [];
    }
  } else if (process.env.SELECTED_CLI) {
    clis = [process.env.SELECTED_CLI];
  } else {
    clis = callback ? [selectedCliOrFunction] : ['nx', 'angular'];
  }

  const cb: any = callback ? callback : selectedCliOrFunction;
  clis.forEach(c => {
    describe(`[${c}]`, () => {
      beforeEach(() => {
        cli = c;
      });
      cb(c);
    });
  });
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

export function workspaceConfigName() {
  return cli === 'angular' ? 'angular.json' : 'workspace.json';
}

function patchPackageJsonDeps(addWorkspace = true) {
  const p = JSON.parse(readFileSync(tmpProjPath('package.json')).toString());
  const workspacePath = path.join(getCwd(), 'build', 'packages', 'workspace');
  const angularPath = path.join(getCwd(), 'build', 'packages', 'angular');
  const reactPath = path.join(getCwd(), 'build', 'packages', 'react');

  if (addWorkspace) {
    p.devDependencies['@nrwl/workspace'] = `file:${workspacePath}`;
  }
  p.devDependencies['@nrwl/angular'] = `file:${angularPath}`;
  p.devDependencies['@nrwl/react'] = `file:${reactPath}`;
  writeFileSync(tmpProjPath('package.json'), JSON.stringify(p, null, 2));
}

export function runYarnInstall(silent: boolean = true) {
  const install = execSync('yarn install', {
    cwd: tmpProjPath(),
    ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
  });
  return install ? install.toString() : '';
}

export function runNew(
  command?: string,
  silent?: boolean,
  addWorkspace = true
): string {
  let gen;
  if (cli === 'angular') {
    gen = execSync(
      `../../node_modules/.bin/ng new proj --no-interactive --skip-install ${command ||
        ''}`,
      {
        cwd: `./tmp/${cli}`,
        ...(silent ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
      }
    );
  } else {
    gen = execSync(
      `node ../../node_modules/@nrwl/tao/index.js new proj --no-interactive --skip-install ${command ||
        ''}`,
      {
        cwd: `./tmp/${cli}`,
        ...(silent && false ? { stdio: ['ignore', 'ignore', 'ignore'] } : {})
      }
    );
  }

  patchPackageJsonDeps(addWorkspace);
  const install = runYarnInstall(silent && false);
  return silent ? null : `${gen ? gen.toString() : ''}${install}`;
}

export function newProject(): void {
  cleanup();
  if (!directoryExists(tmpBackupProjPath())) {
    runNew('--collection=@nrwl/workspace --npmScope=proj', true);
    copyMissingPackages();

    writeFileSync(
      tmpProjPath(
        'node_modules/@angular-devkit/schematics/tasks/node-package/executor.js'
      ),
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

    execSync(`mv ${tmpProjPath()} ${tmpBackupProjPath()}`);
  }
  execSync(`cp -a ${tmpBackupProjPath()} ${tmpProjPath()}`);
}

export function createTestUILib(libName: string): void {
  runCLI(`g @nrwl/angular:library ${libName} --no-interactive`);
  runCLI(
    `g @schematics/angular:component test-button --project=${libName} --no-interactive`
  );

  writeFileSync(
    tmpProjPath(`libs/${libName}/src/lib/test-button/test-button.component.ts`),
    `
import { Component, OnInit, Input } from '@angular/core';

export type ButtonStyle = 'default' | 'primary' | 'accent';

@Component({
  selector: 'proj-test-button',
  templateUrl: './test-button.component.html',
  styleUrls: ['./test-button.component.css']
})
export class TestButtonComponent implements OnInit {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age: number;
  @Input() isOn = false;

  constructor() { }

  ngOnInit() {
  }

}
      `
  );

  writeFileSync(
    tmpProjPath(
      `libs/${libName}/src/lib/test-button/test-button.component.html`
    ),
    `<button [attr.type]="type" [ngClass]="style"></button>`
  );
  runCLI(
    `g @schematics/angular:component test-other --project=${libName} --no-interactive`
  );

  execSync(`cp -a ${tmpBackupProjPath()} ${tmpProjPath()}`);
}

export function ensureProject(): void {
  if (!directoryExists(tmpProjPath())) {
    newProject();
  }
}

export function supportUi() {
  return !process.env.NO_CHROME;
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
    'react-router-dom',
    'styled-components',
    '@types/react',
    '@types/react-dom',
    '@types/react-router-dom',
    '@testing-library',

    // For testing webpack config with babel-loader
    '@babel/core',
    '@babel/preset-env',
    '@babel/preset-react',
    '@babel/preset-typescript',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-decorators',
    'babel-loader',
    'babel-plugin-macros',
    'eslint-plugin-import',
    'eslint-plugin-jsx-a11y',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',

    // For testing web bundle
    'rollup',
    'rollup-plugin-babel',
    'rollup-plugin-commonjs',
    'rollup-plugin-filesize',
    'rollup-plugin-local-resolve',
    'rollup-plugin-node-resolve',
    'rollup-plugin-peer-deps-external',
    'rollup-plugin-postcss',
    'rollup-plugin-typescript2',

    'next',
    'next-server',
    'document-register-element'
  ];
  modulesToCopy.forEach(m => copyNodeModule(m));
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

  execSync(`rm -rf ${tmpProjPath('node_modules/.bin/webpack')}`);
  execSync(
    `cp -a node_modules/.bin/webpack ${tmpProjPath(
      'node_modules/.bin/webpack'
    )}`
  );
  execSync(`rm -rf ${tmpProjPath('node_modules/cypress/node_modules/@types')}`);
  execSync(
    `cp -a node_modules/mime ${tmpProjPath(
      'node_modules/karma/node_modules/mime'
    )}`
  );
}

function copyNodeModule(name: string) {
  execSync(`rm -rf ${tmpProjPath('node_modules/' + name)}`);
  execSync(`cp -a node_modules/${name} ${tmpProjPath('node_modules/' + name)}`);
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
        cwd: tmpProjPath()
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
  return runCommandAsync(
    `node ./node_modules/@nrwl/cli/bin/nx.js ${command}`,
    opts
  );
}

export function runNgAdd(
  command?: string,
  opts = {
    silenceError: false
  }
): string {
  try {
    return execSync(`./node_modules/.bin/ng ${command}`, {
      cwd: tmpProjPath()
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

export function runCLIFromSubfolder(
  command?: string,
  subFolder?: string,
  opts = {
    silenceError: false
  }
): string {
  const backToRoot = subFolder
    ? subFolder
        .split('/')
        .map(_ => '..')
        .join('/')
    : '.';

  try {
    return execSync(
      `node ${backToRoot}/node_modules/@nrwl/cli/bin/nx.js ${command}`,
      {
        cwd: tmpProjPath(subFolder)
      }
    )
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

export function runCLI(
  command?: string,
  opts = {
    silenceError: false
  }
): string {
  try {
    return execSync(`node ./node_modules/@nrwl/cli/bin/nx.js ${command}`, {
      cwd: tmpProjPath()
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
      cwd: tmpProjPath(),
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
  } catch (e) {
    return e.stdout.toString() + e.stderr.toString();
  }
}

export function updateFile(f: string, content: string | Function): void {
  ensureDirSync(path.dirname(tmpProjPath(f)));
  if (typeof content === 'string') {
    writeFileSync(tmpProjPath(f), content);
  } else {
    writeFileSync(
      tmpProjPath(f),
      content(readFileSync(tmpProjPath(f)).toString())
    );
  }
}

export function renameFile(f: string, newPath: string): void {
  ensureDirSync(path.dirname(tmpProjPath(newPath)));
  renameSync(tmpProjPath(f), tmpProjPath(newPath));
}

export function checkFilesExist(...expectedFiles: string[]) {
  expectedFiles.forEach(f => {
    const ff = f.startsWith('/') ? f : tmpProjPath(f);
    if (!exists(ff)) {
      throw new Error(`File '${ff}' does not exist`);
    }
  });
}

export function readJson(f: string): any {
  return JSON.parse(readFile(f));
}

export function readFile(f: string) {
  const ff = f.startsWith('/') ? f : tmpProjPath(f);
  return readFileSync(ff).toString();
}

export function cleanup() {
  execSync(`rm -rf ${tmpProjPath()}`);
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

export function tmpProjPath(path?: string) {
  return path ? `./tmp/${cli}/proj/${path}` : `./tmp/${cli}/proj`;
}

function tmpBackupProjPath(path?: string) {
  return path ? `./tmp/${cli}/proj-backup/${path}` : `./tmp/${cli}/proj-backup`;
}
