import { detectPackageManager } from '@nrwl/tao/src/shared/package-manager';
import { ChildProcess, exec, execSync } from 'child_process';
import {
  copySync,
  createFileSync,
  ensureDirSync,
  moveSync,
  readdirSync,
  readFileSync,
  removeSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs-extra';
import isCI = require('is-ci');
import * as path from 'path';
import { dirSync } from 'tmp';

interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string>;
  cwd?: string;
  silent?: boolean;
}

export function currentCli() {
  return process.env.SELECTED_CLI ?? 'nx';
}

export const e2eRoot = isCI ? dirSync({ prefix: 'nx-e2e-' }).name : `./tmp`;
export const e2eCwd = `${e2eRoot}/${currentCli()}`;
ensureDirSync(e2eCwd);

let projName: string;

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

export function workspaceConfigName() {
  return currentCli() === 'angular' ? 'angular.json' : 'workspace.json';
}

export function updateWorkspaceConfig(
  callback: (json: { [key: string]: any }) => Object
) {
  const file = workspaceConfigName();
  updateFile(file, JSON.stringify(callback(readJson(file)), null, 2));
}

export function runCreateWorkspace(
  name: string,
  {
    preset,
    appName,
    style,
    base,
    packageManager,
    cli,
    extraArgs,
  }: {
    preset: string;
    appName?: string;
    style?: string;
    base?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    cli?: string;
    extraArgs?: string;
  }
) {
  projName = name;

  const pm = getPackageManagerCommand({ packageManager });

  const linterArg =
    preset === 'angular' || preset === 'angular-nest' ? ' --linter=tslint' : '';
  let command = `${pm.createWorkspace} ${name} --cli=${
    cli || currentCli()
  } --preset=${preset} ${linterArg} --no-nxCloud --no-interactive`;
  if (appName) {
    command += ` --appName=${appName}`;
  }
  if (style) {
    command += ` --style=${style}`;
  }

  if (base) {
    command += ` --defaultBase="${base}"`;
  }

  if (packageManager) {
    command += ` --package-manager=${packageManager}`;
  }

  if (extraArgs) {
    command += ` ${extraArgs}`;
  }

  const create = execSync(command, {
    cwd: e2eCwd,
    stdio: [0, 1, 2],
    env: process.env,
  });
  return create ? create.toString() : '';
}

export function packageInstall(pkg: string, projName?: string) {
  const cwd = projName ? `${e2eCwd}/${projName}` : tmpProjPath();
  const pm = getPackageManagerCommand({ path: cwd });
  const install = execSync(`${pm.addDev} ${pkg}`, {
    cwd,
    // ...{ stdio: ['pipe', 'pipe', 'pipe'] },
    ...{ stdio: [0, 1, 2] },
    env: process.env,
  });
  return install ? install.toString() : '';
}

export function runNgNew(): string {
  return execSync(`../../node_modules/.bin/ng new proj --no-interactive`, {
    cwd: e2eCwd,
    env: process.env,
  }).toString();
}

export function getSelectedPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  return process.env.SELECTED_PM as 'npm' | 'yarn' | 'pnpm';
}

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newProject({ name = uniq('proj') } = {}): string {
  const packageManager = getSelectedPackageManager();

  try {
    const useBackupProject = packageManager !== 'pnpm';
    const projScope = useBackupProject ? 'proj' : name;

    if (!useBackupProject || !directoryExists(tmpBackupProjPath())) {
      runCreateWorkspace(projScope, { preset: 'empty', packageManager });

      // Temporary hack to prevent installing with `--frozen-lockfile`
      if (isCI && packageManager === 'pnpm') {
        updateFile('.npmrc', 'prefer-frozen-lockfile=false');
      }

      const packages = [
        `@nrwl/angular`,
        `@nrwl/express`,
        `@nrwl/jest`,
        `@nrwl/linter`,
        `@nrwl/nest`,
        `@nrwl/next`,
        `@nrwl/gatsby`,
        `@nrwl/node`,
        `@nrwl/react`,
        `@nrwl/storybook`,
        `@nrwl/nx-plugin`,
        `@nrwl/eslint-plugin-nx`,
        `@nrwl/web`,
      ];
      packageInstall(packages.join(` `), projScope);

      if (useBackupProject) {
        moveSync(`${e2eCwd}/proj`, `${tmpBackupProjPath()}`);
      }
    }
    projName = name;
    if (useBackupProject) {
      copySync(`${tmpBackupProjPath()}`, `${tmpProjPath()}`);
    }
    return projScope;
  } catch (e) {
    console.log(`Failed to set up project for e2e tests.`);
    console.log(e.message);
    throw e;
  }
}

// Useful in order to cleanup space during CI to prevent `No space left on device` exceptions
export function removeProject({ onlyOnCI = false } = {}) {
  if (onlyOnCI && !isCI) {
    return;
  }
  removeSync(tmpProjPath());
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
        cwd: tmpProjPath(),
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

export function runCommandUntil(
  command: string,
  criteria: (output: string) => boolean,
  { kill = true } = {}
): Promise<{ process: ChildProcess }> {
  const pm = getPackageManagerCommand();
  const p = exec(`${pm.runNx} ${command}`, {
    cwd: tmpProjPath(),
    env: { ...process.env, FORCE_COLOR: 'false' },
  });

  return new Promise((res, rej) => {
    let output = '';
    let complete = false;

    function checkCriteria(c) {
      output += c.toString();
      if (criteria(output)) {
        complete = true;
        res({ process: p });
        if (kill) {
          p.kill();
        }
      }
    }

    p.stdout.on('data', checkCriteria);
    p.stderr.on('data', checkCriteria);
    p.on('exit', (code) => {
      if (code !== 0 && !complete) {
        console.log(output);
      }
      rej(`Exited with ${code}`);
    });
  });
}

export function runCLIAsync(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: process.env,
    silent: false,
  }
): Promise<{ stdout: string; stderr: string; combinedOutput: string }> {
  const pm = getPackageManagerCommand();
  return runCommandAsync(
    `${opts.silent ? pm.runNxSilent : pm.runNx} ${command}`,
    opts
  );
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
    packageInstall('@nrwl/workspace');
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
    const pm = getPackageManagerCommand();
    let r = execSync(`${pm.runNx} ${command}`, {
      cwd: opts.cwd || tmpProjPath(),
      env: opts.env,
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
      console.log('original command', command);
      console.log(e.stdout?.toString(), e.stderr?.toString());
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
 * Sets maxWorkers in CI on all projects that require it
 * so that it doesn't try to run it with 34 workers
 *
 * maxWorkers required for: node, web, jest
 */
function setMaxWorkers() {
  if (isCI) {
    const workspaceFile = workspaceConfigName();
    const workspace = readJson(workspaceFile);

    Object.keys(workspace.projects).forEach((appName) => {
      const project = workspace.projects[appName];
      const { build } = project.targets ?? project.architect;

      if (!build) {
        return;
      }

      const executor = build.builder ?? build.executor;
      if (
        executor.startsWith('@nrwl/node') ||
        executor.startsWith('@nrwl/web') ||
        executor.startsWith('@nrwl/jest')
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

export function updateFile(
  f: string,
  content: string | ((content: string) => string)
): void {
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
  removeSync(`${tmpProjPath()}/dist`);
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
  return path ? `${e2eCwd}/${projName}/${path}` : `${e2eCwd}/${projName}`;
}

function tmpBackupProjPath(path?: string) {
  return path ? `${e2eCwd}/proj-backup/${path}` : `${e2eCwd}/proj-backup`;
}

export function getPackageManagerCommand({
  path = tmpProjPath(),
  packageManager = detectPackageManager(path),
  scriptsPrependNodePath = true,
} = {}): {
  createWorkspace: string;
  runNx: string;
  runNxSilent: string;
  addDev: string;
  list: string;
} {
  const scriptsPrependNodePathFlag = scriptsPrependNodePath
    ? ' --scripts-prepend-node-path '
    : '';

  return {
    npm: {
      createWorkspace: `npx create-nx-workspace@${process.env.PUBLISHED_VERSION}`,
      runNx: `npm run nx${scriptsPrependNodePathFlag} --`,
      runNxSilent: `npm run nx --silent${scriptsPrependNodePathFlag} --`,
      addDev: `npm install --legacy-peer-deps -D`,
      list: 'npm ls --depth 10',
    },
    yarn: {
      // `yarn create nx-workspace` is failing due to wrong global path
      createWorkspace: `yarn global add create-nx-workspace@${process.env.PUBLISHED_VERSION} && create-nx-workspace`,
      runNx: `yarn nx`,
      runNxSilent: `yarn --silent nx`,
      addDev: `yarn add -D`,
      list: 'npm ls --depth 10',
    },
    pnpm: {
      createWorkspace: `pnpx create-nx-workspace@${process.env.PUBLISHED_VERSION}`,
      runNx: `pnpm run nx --`,
      runNxSilent: `pnpm run nx --silent --`,
      addDev: `pnpm add -D`,
      list: 'npm ls --depth 10',
    },
  }[packageManager];
}

export function expectNoAngularDevkit() {
  const { list } = getPackageManagerCommand();
  const result = runCommand(`${list} @angular-devkit/core`);
  expect(result).not.toContain('@angular-devkit/core');
}
