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

export function currentCli() {
  return process.env.SELECTED_CLI ? process.env.SELECTED_CLI : 'nx';
}

let projName: string;

function setCurrentProjName(name: string) {
  projName = name;
  return name;
}

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

export function workspaceConfigName() {
  return currentCli() === 'angular' ? 'angular.json' : 'workspace.json';
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
    packageManager?: string;
    cli?: string;
    extraArgs?: string;
  }
) {
  setCurrentProjName(name);

  const linterArg =
    preset === 'angular' || preset === 'angular-nest' ? ' --linter=tslint' : '';
  let command = `npx create-nx-workspace@${
    process.env.PUBLISHED_VERSION
  } ${name} --cli=${
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
    cwd: `./tmp/${currentCli()}`,
    stdio: [0, 1, 2],
    env: process.env,
  });
  return create ? create.toString() : '';
}

export function yarnAdd(pkg: string, projName?: string) {
  const cwd = projName ? `./tmp/${currentCli()}/${projName}` : tmpProjPath();
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
    cwd: `./tmp/${currentCli()}`,
    env: process.env,
  }).toString();
}

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newProject(): void {
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
      execSync(`mv ./tmp/${currentCli()}/proj ${tmpBackupProjPath()}`);
    }
    projName = uniq('proj');
    execSync(`cp -a ${tmpBackupProjPath()} ${tmpProjPath()}`);
  } catch (e) {
    console.log(`Failed to set up project for e2e tests.`);
    console.log(e.message);
    throw e;
  }
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
  criteria: (output: string) => boolean
) {
  const p = exec(`./node_modules/.bin/nx ${command}`, {
    cwd: tmpProjPath(),
    env: { ...process.env, FORCE_COLOR: 'false' },
  });

  return new Promise((res, rej) => {
    let output = '';
    let complete = false;
    p.stdout.on('data', (c) => {
      output += c.toString();
      if (criteria(output)) {
        complete = true;
        res(true);
        p.kill();
      }
    });
    p.stderr.on('data', (c) => {
      output += c.toString();
      if (criteria(output)) {
        complete = true;
        res(true);
        p.kill();
      }
    });
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
      const targets = workspace.projects[appName].targets
        ? workspace.projects[appName].targets
        : workspace.projects[appName].architect;
      const build = targets.build;

      if (!build) {
        return;
      }

      const executor = build.builder ? build.builder : build.executor;
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
  content: string | ((content: string) => void)
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
  return path
    ? `./tmp/${currentCli()}/${projName}/${path}`
    : `./tmp/${currentCli()}/${projName}`;
}

function tmpBackupProjPath(path?: string) {
  return path
    ? `./tmp/${currentCli()}/proj-backup/${path}`
    : `./tmp/${currentCli()}/proj-backup`;
}
