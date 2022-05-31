import {
  joinPathFragments,
  parseJson,
  ProjectConfiguration,
  readJsonFile,
  ProjectsConfigurations,
} from '@nrwl/devkit';
import { angularCliVersion } from '@nrwl/workspace/src/utils/versions';
import { ChildProcess, exec, execSync, ExecSyncOptions } from 'child_process';
import {
  copySync,
  createFileSync,
  ensureDirSync,
  existsSync,
  moveSync,
  readdirSync,
  readFileSync,
  removeSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs-extra';
import * as path from 'path';
import { join } from 'path';
import { coerce } from 'semver';
import { check as portCheck } from 'tcp-port-used';
import { dirSync } from 'tmp';
import { promisify } from 'util';
import chalk = require('chalk');
import isCI = require('is-ci');
import treeKill = require('tree-kill');
import { Workspaces } from '../../packages/nx/src/config/workspaces';
import { PackageManager } from 'nx/src/utils/package-manager';

export function getPublishedVersion(): string {
  process.env.PUBLISHED_VERSION =
    process.env.PUBLISHED_VERSION ||
    // read version of built nx package
    readJsonFile(`./build/packages/nx/package.json`).version ||
    // fallback to latest if built nx package is missing
    'latest';
  return process.env.PUBLISHED_VERSION;
}

export function detectPackageManager(dir: string = ''): PackageManager {
  return existsSync(join(dir, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(dir, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : 'npm';
}

const kill = require('kill-port');
export const isWindows = require('is-windows');

export const promisifiedTreeKill: (
  pid: number,
  signal: string
) => Promise<void> = promisify(treeKill);

interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string>;
  cwd?: string;
  silent?: boolean;
}

export function currentCli() {
  return process.env.SELECTED_CLI || 'nx';
}

export const e2eRoot = isCI
  ? dirSync({ prefix: 'nx-e2e-' }).name
  : '/tmp/nx-e2e';

export const e2eCwd = `${e2eRoot}/${currentCli()}`;
ensureDirSync(e2eCwd);

let projName: string;

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

export function workspaceConfigName() {
  return currentCli() === 'angular' ? 'angular.json' : 'workspace.json';
}

export function updateProjectConfig(
  projectName: string,
  callback: (c: ProjectConfiguration) => ProjectConfiguration
) {
  const root = readJson(workspaceConfigName()).projects[projectName];
  const path = join(root, 'project.json');
  const current = readJson(path);
  updateFile(path, JSON.stringify(callback(current), null, 2));
}

/**
 * Use readProjectConfig or readInlineProjectConfig instead
 * if you need a project's configuration.
 */
export function readWorkspaceConfig(): Omit<
  ProjectsConfigurations,
  'projects'
> {
  const w = readJson(workspaceConfigName());
  delete w.projects;
  return w;
}

export function readProjectConfig(projectName: string): ProjectConfiguration {
  const root = readJson(workspaceConfigName()).projects[projectName];
  const path = join(root, 'project.json');
  return readJson(path);
}

export function createNonNxProjectDirectory(name = uniq('proj')) {
  projName = name;
  ensureDirSync(tmpProjPath());
  createFile(
    'package.json',
    JSON.stringify({
      name,
    })
  );
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
    ci,
    useDetectedPm = false,
  }: {
    preset: string;
    appName?: string;
    style?: string;
    base?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    cli?: string;
    extraArgs?: string;
    ci?: 'azure' | 'github' | 'circleci';
    useDetectedPm?: boolean;
  }
) {
  projName = name;

  const pm = getPackageManagerCommand({ packageManager });

  let command = `${pm.createWorkspace} ${name} --cli=${
    cli || currentCli()
  } --preset=${preset} --no-nxCloud --no-interactive`;
  if (appName) {
    command += ` --appName=${appName}`;
  }
  if (style) {
    command += ` --style=${style}`;
  }
  if (ci) {
    command += ` --ci=${ci}`;
  }

  if (base) {
    command += ` --defaultBase="${base}"`;
  }

  if (packageManager && !useDetectedPm) {
    command += ` --package-manager=${packageManager}`;
  }

  if (extraArgs) {
    command += ` ${extraArgs}`;
  }

  const create = execSync(command, {
    cwd: e2eCwd,
    // stdio: [0, 1, 2],
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    encoding: 'utf-8',
  });
  return create ? create.toString() : '';
}

export function runCreatePlugin(
  name: string,
  {
    pluginName,
    packageManager,
    extraArgs,
    useDetectedPm = false,
  }: {
    pluginName?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    extraArgs?: string;
    useDetectedPm?: boolean;
  }
) {
  projName = name;

  const pm = getPackageManagerCommand({ packageManager });

  let command = `${
    pm.runUninstalledPackage
  } create-nx-plugin@${getPublishedVersion()} ${name}`;

  if (pluginName) {
    command += ` --pluginName=${pluginName}`;
  }

  if (packageManager && !useDetectedPm) {
    command += ` --package-manager=${packageManager}`;
  }

  if (extraArgs) {
    command += ` ${extraArgs}`;
  }

  const create = execSync(command, {
    cwd: e2eCwd,
    //stdio: [0, 1, 2],
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    encoding: 'utf-8',
  });
  return create ? create.toString() : '';
}

export function packageInstall(
  pkg: string,
  projName?: string,
  version = getPublishedVersion()
) {
  const cwd = projName ? `${e2eCwd}/${projName}` : tmpProjPath();
  const pm = getPackageManagerCommand({ path: cwd });
  const pkgsWithVersions = pkg
    .split(' ')
    .map((pgk) => `${pgk}@${version}`)
    .join(' ');
  const install = execSync(`${pm.addDev} ${pkgsWithVersions}`, {
    cwd,
    // stdio: [0, 1, 2],
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
    encoding: 'utf-8',
  });
  return install ? install.toString() : '';
}

export function runNgNew(
  projectName: string,
  packageManager = getSelectedPackageManager()
): string {
  projName = projectName;

  const npmMajorVersion = getNpmMajorVersion();
  const command = `npx ${
    +npmMajorVersion >= 7 ? '--yes' : ''
  } @angular/cli@${angularCliVersion} new ${projectName} --package-manager=${packageManager}`;

  return execSync(command, {
    cwd: e2eCwd,
    env: process.env,
    encoding: 'utf-8',
  }).toString();
}

export function getSelectedPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  return (process.env.SELECTED_PM as 'npm' | 'yarn' | 'pnpm') || 'npm';
}

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newProject({
  name = uniq('proj'),
  packageManager = getSelectedPackageManager(),
} = {}): string {
  try {
    const useBackupProject = packageManager !== 'pnpm';
    const projScope = useBackupProject ? 'proj' : name;

    if (!useBackupProject || !directoryExists(tmpBackupProjPath())) {
      runCreateWorkspace(projScope, {
        preset: 'empty',
        packageManager,
      });

      // Temporary hack to prevent installing with `--frozen-lockfile`
      if (isCI && packageManager === 'pnpm') {
        updateFile(
          '.npmrc',
          'prefer-frozen-lockfile=false\nstrict-peer-dependencies=false\nauto-install-peers=true'
        );
      }

      const packages = [
        `@nrwl/angular`,
        `@nrwl/eslint-plugin-nx`,
        `@nrwl/express`,
        `@nrwl/jest`,
        `@nrwl/js`,
        `@nrwl/linter`,
        `@nrwl/nest`,
        `@nrwl/next`,
        `@nrwl/node`,
        `@nrwl/nx-plugin`,
        `@nrwl/react`,
        `@nrwl/storybook`,
        `@nrwl/web`,
        `@nrwl/react-native`,
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

    if (process.env.NX_VERBOSE_LOGGING == 'true') {
      console.log(`E2E test is creating a project: ${tmpProjPath()}`);
    }
    return projScope;
  } catch (e) {
    logError(`Failed to set up project for e2e tests.`, e.message);
    throw e;
  }
}

const KILL_PORT_DELAY = 5000;

export async function killPort(port: number): Promise<boolean> {
  if (await portCheck(port)) {
    try {
      logInfo(`Attempting to close port ${port}`);
      await kill(port);
      await new Promise<void>((resolve) =>
        setTimeout(() => resolve(), KILL_PORT_DELAY)
      );
      if (await portCheck(port)) {
        logError(`Port ${port} still open`);
      } else {
        logSuccess(`Port ${port} successfully closed`);
        return true;
      }
    } catch {
      logError(`Port ${port} closing failed`);
    }
    return false;
  } else {
    return true;
  }
}

export async function killPorts(port?: number): Promise<boolean> {
  return port
    ? await killPort(port)
    : (await killPort(3333)) && (await killPort(4200));
}

// Useful in order to cleanup space during CI to prevent `No space left on device` exceptions
export async function cleanupProject() {
  if (isCI) {
    try {
      removeSync(tmpProjPath());
    } catch (e) {}
  }
}

export function runCypressTests() {
  return process.env.NX_E2E_RUN_CYPRESS === 'true';
}

export function isNotWindows() {
  return !isWindows();
}

export function isOSX() {
  return process.platform === 'darwin';
}

export function isAndroid() {
  return (
    process.platform === 'linux' &&
    process.env.ANDROID_HOME &&
    process.env.ANDROID_SDK_ROOT
  );
}

export function runCommandAsync(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: null,
  }
): Promise<{ stdout: string; stderr: string; combinedOutput: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: tmpProjPath(),
        env: {
          ...(opts.env || process.env),
          FORCE_COLOR: 'false',
        },
        encoding: 'utf-8',
      },
      (err, stdout, stderr) => {
        if (!opts.silenceError && err) {
          reject(err);
        }
        resolve({
          stdout: stripConsoleColors(stdout),
          stderr: stripConsoleColors(stderr),
          combinedOutput: stripConsoleColors(`${stdout}${stderr}`),
        });
      }
    );
  });
}

export function runCommandUntil(
  command: string,
  criteria: (output: string) => boolean
): Promise<ChildProcess> {
  const pm = getPackageManagerCommand();
  const p = exec(`${pm.runNx} ${command}`, {
    cwd: tmpProjPath(),
    env: {
      ...process.env,
      FORCE_COLOR: 'false',
    },
    encoding: 'utf-8',
  });
  return new Promise((res, rej) => {
    let output = '';
    let complete = false;

    function checkCriteria(c) {
      output += c.toString();
      if (criteria(stripConsoleColors(output)) && !complete) {
        complete = true;
        res(p);
      }
    }

    p.stdout.on('data', checkCriteria);
    p.stderr.on('data', checkCriteria);
    p.on('exit', (code) => {
      if (!complete) {
        rej(`Exited with ${code}`);
      } else {
        res(p);
      }
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
  packageName: string,
  command?: string,
  version: string = getPublishedVersion(),
  opts: RunCmdOpts = {
    silenceError: false,
    env: null,
    cwd: tmpProjPath(),
  }
): string {
  try {
    const pmc = getPackageManagerCommand();
    packageInstall(packageName, null, version);
    return execSync(pmc.run(`ng g ${packageName}:ng-add`, command ?? ''), {
      cwd: tmpProjPath(),
      env: { ...(opts.env || process.env) },
      encoding: 'utf-8',
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
      logError(
        `Ng Add failed: ${command}`,
        `${e.stdout?.toString()}\n\n${e.stderr?.toString()}`
      );
      throw e;
    }
  }
}

export function runCLI(
  command?: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: null,
  }
): string {
  try {
    const pm = getPackageManagerCommand();
    let r = stripConsoleColors(
      execSync(`${pm.runNx} ${command}`, {
        cwd: opts.cwd || tmpProjPath(),
        env: { ...(opts.env || process.env) },
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      })
    );
    if (process.env.NX_VERBOSE_LOGGING) {
      logInfo(`result of running: ${command}`, r);
    }

    const needsMaxWorkers = /g.*(express|nest|node|web|react):app.*/;
    if (needsMaxWorkers.test(command)) {
      setMaxWorkers();
    }

    return r;
  } catch (e) {
    if (opts.silenceError) {
      return stripConsoleColors(e.stdout?.toString() + e.stderr?.toString());
    } else {
      logError(
        `Original command: ${command}`,
        `${e.stdout?.toString()}\n\n${e.stderr?.toString()}`
      );
      throw e;
    }
  }
}

/**
 * Remove log colors for fail proof string search
 * @param log
 * @returns
 */
function stripConsoleColors(log: string): string {
  return log.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

export function expectTestsPass(v: { stdout: string; stderr: string }) {
  expect(v.stderr).toContain('Ran all test suites');
  expect(v.stderr).not.toContain('fail');
}

export function runCommand(
  command: string,
  options?: Partial<ExecSyncOptions>
): string {
  try {
    const r = execSync(command, {
      cwd: tmpProjPath(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: 'false',
      },
      encoding: 'utf-8',
      ...options,
    }).toString();
    if (process.env.NX_VERBOSE_LOGGING) {
      console.log(r);
    }
    return r;
  } catch (e) {
    // this is intentional
    // npm ls fails if package is not found
    return e.stdout?.toString() + e.stderr?.toString();
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
    const ws = new Workspaces(tmpProjPath());
    const workspaceFile = workspaceConfigName();
    const workspaceFileExists = fileExists(tmpProjPath(workspaceFile));
    const workspace = ws.readWorkspaceConfiguration();
    const rawWorkspace = workspaceFileExists ? readJson(workspaceFile) : null;
    let requireWorkspaceFileUpdate = false;

    Object.keys(workspace.projects).forEach((appName) => {
      let project = workspace.projects[appName];
      const { build } = project.targets;

      if (!build) {
        return;
      }

      const executor = build.executor;
      if (
        executor.startsWith('@nrwl/node') ||
        executor.startsWith('@nrwl/web') ||
        executor.startsWith('@nrwl/jest')
      ) {
        build.options.maxWorkers = 4;
      }

      if (
        !workspaceFileExists ||
        typeof rawWorkspace.projects[appName] === 'string'
      ) {
        updateFile(
          join(project.root, 'project.json'),
          JSON.stringify(project, null, 2)
        );
      } else {
        requireWorkspaceFileUpdate = true;
      }
    });
    if (workspaceFileExists && requireWorkspaceFileUpdate) {
      updateFile(workspaceFile, JSON.stringify(workspace));
    }
  }
}

export function createFile(f: string, content: string = ''): void {
  const path = tmpProjPath(f);
  createFileSync(path);
  if (content) {
    updateFile(f, content);
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

export function updateJson<T extends object = any, U extends object = T>(
  f: string,
  updater: (value: T) => U
) {
  updateFile(f, (s) => {
    const json = JSON.parse(s);
    return JSON.stringify(updater(json), null, 2);
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
  const content = readFile(f);
  return parseJson(content);
}

export function readFile(f: string) {
  const ff = f.startsWith('/') ? f : tmpProjPath(f);
  return readFileSync(ff, 'utf-8');
}

export function removeFile(f: string) {
  const ff = f.startsWith('/') ? f : tmpProjPath(f);
  removeSync(ff);
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

const E2E_LOG_PREFIX = `${chalk.reset.inverse.bold.keyword('orange')(' E2E ')}`;

function e2eConsoleLogger(message: string, body?: string) {
  process.stdout.write('\n');
  process.stdout.write(`${E2E_LOG_PREFIX} ${message}\n`);
  if (body) {
    process.stdout.write(`${body}\n`);
  }
  process.stdout.write('\n');
}

export function logInfo(title: string, body?: string) {
  const message = `${chalk.reset.inverse.bold.white(
    ' INFO '
  )} ${chalk.bold.white(title)}`;
  return e2eConsoleLogger(message, body);
}

export function logError(title: string, body?: string) {
  const message = `${chalk.reset.inverse.bold.red(' ERROR ')} ${chalk.bold.red(
    title
  )}`;
  return e2eConsoleLogger(message, body);
}

export function logSuccess(title: string, body?: string) {
  const message = `${chalk.reset.inverse.bold.green(
    ' SUCCESS '
  )} ${chalk.bold.green(title)}`;
  return e2eConsoleLogger(message, body);
}

export function getPackageManagerCommand({
  path = tmpProjPath(),
  packageManager = detectPackageManager(path),
} = {}): {
  createWorkspace: string;
  run: (script: string, args: string) => string;
  runNx: string;
  runNxSilent: string;
  runUninstalledPackage?: string | undefined;
  addDev: string;
  list: string;
} {
  const npmMajorVersion = getNpmMajorVersion();

  return {
    npm: {
      createWorkspace: `npx ${
        +npmMajorVersion >= 7 ? '--yes' : ''
      } create-nx-workspace@${getPublishedVersion()}`,
      run: (script: string, args: string) => `npm run ${script} -- ${args}`,
      runNx: `npx nx`,
      runNxSilent: `npx nx`,
      runUninstalledPackage: `npx --yes`,
      addDev: `npm install --legacy-peer-deps -D`,
      list: 'npm ls --depth 10',
    },
    yarn: {
      // `yarn create nx-workspace` is failing due to wrong global path
      createWorkspace: `yarn global add create-nx-workspace@${getPublishedVersion()} && create-nx-workspace`,
      run: (script: string, args: string) => `yarn ${script} ${args}`,
      runNx: `yarn nx`,
      runNxSilent: `yarn --silent nx`,
      runUninstalledPackage: 'npx --yes',
      addDev: `yarn add -D`,
      list: 'npm ls --depth 10',
    },
    // Pnpm 3.5+ adds nx to
    pnpm: {
      createWorkspace: `pnpm dlx create-nx-workspace@${getPublishedVersion()}`,
      run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
      runNx: `pnpm exec nx`,
      runNxSilent: `pnpm exec nx`,
      runUninstalledPackage: 'pnpm dlx',
      addDev: `pnpm add -D`,
      list: 'npm ls --depth 10',
    },
  }[packageManager.trim()];
}

function getNpmMajorVersion(): string {
  const [npmMajorVersion] = execSync(`npm -v`).toString().split('.');
  return npmMajorVersion;
}

export const packageManagerLockFile = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
};

export function expectNoAngularDevkit() {
  const { list } = getPackageManagerCommand();
  const result = runCommand(`${list} @angular-devkit/core`);
  expect(result).not.toContain('@angular-devkit/core');
}

export function expectNoTsJestInJestConfig(appName: string) {
  const jestConfig = readFile(
    joinPathFragments('apps', appName, 'jest.config.ts')
  );
  expect(jestConfig).not.toContain('ts-jest');
}

export function waitUntil(
  predicate: () => boolean,
  opts: { timeout: number; ms: number; allowError?: boolean } = {
    timeout: 5000,
    ms: 50,
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      const run = () => {};
      try {
        run();
        if (predicate()) {
          clearInterval(t);
          resolve();
        }
      } catch (e) {
        if (opts.allowError) reject(e);
      }
    }, opts.ms);

    setTimeout(() => {
      clearInterval(t);
      reject(new Error(`Timed out waiting for condition to return true`));
    }, opts.timeout);
  });
}

type GeneratorsWithDefaultTests =
  | '@nrwl/js:lib'
  | '@nrwl/node:lib'
  | '@nrwl/react:lib'
  | '@nrwl/react:app'
  | '@nrwl/next:app'
  | '@nrwl/angular:app'
  | '@nrwl/workspace:lib'
  | '@nrwl/web:app';

/**
 * Runs the pass in generator and then runs test on
 * the generated project to make sure the default tests pass.
 */
export async function expectJestTestsToPass(
  generator: GeneratorsWithDefaultTests | string
) {
  const name = uniq('proj');
  const generatedResults = runCLI(
    `generate ${generator} ${name} --no-interactive`
  );
  expect(generatedResults).toContain(`jest.config.ts`);

  const results = await runCLIAsync(`test ${name}`);
  expect(results.combinedOutput).toContain('Test Suites: 1 passed, 1 total');
}
