import { exec, execSync } from 'child_process';
import {
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { ensureDirSync, createFileSync } from 'fs-extra';
import * as path from 'path';

interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string>;
  cwd?: string;
}

export let cli;
let projName: string;

export function setCurrentProjName(name: string) {
  projName = name;
  return name;
}

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
  clis.forEach((c) => {
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

export function runCreateWorkspace(
  name: string,
  {
    preset,
    appName,
    style,
    base,
  }: {
    preset: string;
    appName?: string;
    style?: string;
    base?: string;
  }
) {
  let command = `npx create-nx-workspace@${process.env.PUBLISHED_VERSION} ${name} --cli=${cli} --preset=${preset} --no-nxCloud --no-interactive`;
  if (appName) {
    command += ` --appName=${appName}`;
  }
  if (style) {
    command += ` --style=${style}`;
  }

  if (base) {
    command += ` --defaultBase="${base}"`;
  }

  const create = execSync(command, {
    cwd: `./tmp/${cli}`,
    stdio: [0, 1, 2],
    // stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });
  return create ? create.toString() : '';
}

export function yarnAdd(pkg: string, projName?: string) {
  const cwd = projName ? `./tmp/${cli}/${projName}` : tmpProjPath();
  const install = execSync(`yarn add ${pkg}`, {
    cwd,
    // ...{ stdio: ['pipe', 'pipe', 'pipe'] },
    ...{ stdio: [0, 1, 2] },
    env: process.env,
  });
  return install ? install.toString() : '';
}

export function runNgNew(): string {
  return execSync(`../../node_modules/.bin/ng new proj --no-interactive`, {
    cwd: `./tmp/${cli}`,
    env: process.env,
  }).toString();
}

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newProject(): void {
  projName = uniq('proj');
  try {
    if (!directoryExists(tmpBackupProjPath())) {
      runCreateWorkspace('proj', { preset: 'empty' });
      const packages = [
        `@nrwl/angular`,
        `@nrwl/express`,
        `@nrwl/nest`,
        `@nrwl/next`,
        `@nrwl/react`,
        `@nrwl/storybook`,
        `@nrwl/nx-plugin`,
        `@nrwl/eslint-plugin-nx`,
      ];
      yarnAdd(packages.join(` `), 'proj');
      packages
        .filter(
          (f) => f !== '@nrwl/nx-plugin' && f !== `@nrwl/eslint-plugin-nx`
        )
        .forEach((p) => {
          runCLI(`g ${p}:init`, { cwd: `./tmp/${cli}/proj` });
        });
      execSync(`mv ./tmp/${cli}/proj ${tmpBackupProjPath()}`);
    }
    execSync(`cp -a ${tmpBackupProjPath()} ${tmpProjPath()}`);
  } catch (e) {
    console.log(`Failed to set up project for e2e tests.`);
    console.log(e.message);
    throw e;
  }
}

/**
 * Ensures that a project has been setup
 * in the temporary project path for the
 * currently selected CLI.
 *
 * If one is not found, it creates a new project.
 */
export function ensureProject(): void {
  // if (!directoryExists(tmpProjPath())) {
  newProject();
  // }
}

export function supportUi() {
  return false;
  // return !process.env.NO_CHROME;
}

export function runCommandAsync(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: process.env,
  }
): Promise<{ stdout: string; stderr: string; combinedOutput: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: opts.cwd || tmpProjPath(),
        env: { ...process.env, FORCE_COLOR: 'false' },
      },
      (err, stdout, stderr) => {
        if (!opts.silenceError && err) {
          reject(err);
        }
        resolve({ stdout, stderr, combinedOutput: `${stdout}${stderr}` });
      }
    );
  });
}

export function runCLIAsync(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: process.env,
  }
): Promise<{ stdout: string; stderr: string; combinedOutput: string }> {
  return runCommandAsync(`./node_modules/.bin/nx ${command}`, opts);
}

export function runNgAdd(
  command?: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: process.env,
    cwd: tmpProjPath(),
  }
): string {
  try {
    yarnAdd('@nrwl/workspace');
    return execSync(
      `./node_modules/.bin/ng g @nrwl/workspace:ng-add ${command}`,
      {
        cwd: tmpProjPath(),
        env: opts.env as any,
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
  opts: RunCmdOpts = {
    silenceError: false,
    env: process.env,
  }
): string {
  try {
    let r = execSync(`./node_modules/.bin/nx ${command}`, {
      cwd: opts.cwd || tmpProjPath(),
      env: opts.env as any,
    }).toString();
    r = r.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ''
    );
    if (process.env.VERBOSE_OUTPUT) {
      console.log(r);
    }

    const needsMaxWorkers = /g.*(express|nest|node|web|react):app.*/;
    if (needsMaxWorkers.test(command)) {
      setMaxWorkers();
    }

    return r;
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
    const r = execSync(command, {
      cwd: tmpProjPath(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: 'false' },
    }).toString();
    if (process.env.VERBOSE_OUTPUT) {
      console.log(r);
    }
    return r;
  } catch (e) {
    return e.stdout.toString() + e.stderr.toString();
  }
}

/**
 * Sets maxWorkers in CircleCI on all projects that require it
 * so that it doesn't try to run it with 34 workers
 *
 * maxWorkers required for: node, web, jest
 */
function setMaxWorkers() {
  if (process.env['CIRCLECI']) {
    const workspaceFile = workspaceConfigName();
    const workspace = readJson(workspaceFile);

    Object.keys(workspace.projects).forEach((appName) => {
      const {
        architect: { build },
      } = workspace.projects[appName];

      if (!build) {
        return;
      }

      if (
        build.builder.startsWith('@nrwl/node') ||
        build.builder.startsWith('@nrwl/web') ||
        build.builder.startsWith('@nrwl/jest')
      ) {
        build.options.maxWorkers = 4;
      }
    });

    updateFile(workspaceFile, JSON.stringify(workspace));
  }
}

export function createFile(f: string, content: string = ''): void {
  const path = tmpProjPath(f);
  createFileSync(path);
  if (content) {
    updateFile(path, content);
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
  expectedFiles.forEach((f) => {
    const ff = f.startsWith('/') ? f : tmpProjPath(f);
    if (!exists(ff)) {
      throw new Error(`File '${ff}' does not exist`);
    }
  });
}

export function checkFilesDoNotExist(...expectedFiles: string[]) {
  expectedFiles.forEach((f) => {
    const ff = f.startsWith('/') ? f : tmpProjPath(f);
    if (exists(ff)) {
      throw new Error(`File '${ff}' does not exist`);
    }
  });
}

export function listFiles(dirName: string) {
  return readdirSync(tmpProjPath(dirName));
}

export function readJson(f: string): any {
  return JSON.parse(readFile(f));
}

export function readFile(f: string) {
  const ff = f.startsWith('/') ? f : tmpProjPath(f);
  return readFileSync(ff).toString();
}

export function rmDist() {
  execSync(`rm -rf ${tmpProjPath()}/dist`);
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
  return path ? `./tmp/${cli}/${projName}/${path}` : `./tmp/${cli}/${projName}`;
}

function tmpBackupProjPath(path?: string) {
  return path ? `./tmp/${cli}/proj-backup/${path}` : `./tmp/${cli}/proj-backup`;
}
