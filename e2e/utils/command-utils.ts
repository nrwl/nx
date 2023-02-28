import { PackageManager } from '@nrwl/devkit';
import { packageInstall, tmpProjPath } from './create-project-utils';
import {
  detectPackageManager,
  ensureCypressInstallation,
  getNpmMajorVersion,
  getPublishedVersion,
  getStrippedEnvironmentVariables,
} from './get-env-info';
import { TargetConfiguration } from '@nrwl/devkit';
import { ChildProcess, exec, execSync, ExecSyncOptions } from 'child_process';
import { join } from 'path';
import { check as portCheck } from 'tcp-port-used';
import * as isCI from 'is-ci';
import { Workspaces } from '../../packages/nx/src/config/workspaces';
import { isVerbose } from './get-env-info';
import { updateFile } from './file-utils';
import { logError, logInfo, logSuccess, stripConsoleColors } from './log-utils';

export const kill = require('kill-port');

export interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string | undefined>;
  cwd?: string;
  silent?: boolean;
}

/**
 * Sets maxWorkers in CI on all projects that require it
 * so that it doesn't try to run it with 34 workers
 *
 * maxWorkers required for: node, web, jest
 */
export function setMaxWorkers() {
  if (isCI) {
    const ws = new Workspaces(tmpProjPath());
    const projectsConfigurations = ws.readProjectsConfigurations();

    Object.keys(projectsConfigurations.projects).forEach((appName) => {
      let project = projectsConfigurations.projects[appName];
      const { build } = project.targets as {
        [targetName: string]: TargetConfiguration<any>;
      };

      if (!build) {
        return;
      }

      const executor = build.executor as string;
      if (
        executor.startsWith('@nrwl/node') ||
        executor.startsWith('@nrwl/web') ||
        executor.startsWith('@nrwl/jest')
      ) {
        build.options.maxWorkers = 4;
      }

      updateFile(
        join(project.root, 'project.json'),
        JSON.stringify(project, null, 2)
      );
    });
  }
}

export function runCommand(
  command: string,
  options?: Partial<ExecSyncOptions> & { failOnError?: boolean }
): string {
  const { failOnError, ...childProcessOptions } = options ?? {};
  try {
    const r = execSync(command, {
      cwd: tmpProjPath(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...getStrippedEnvironmentVariables(),
        ...childProcessOptions?.env,
        FORCE_COLOR: 'false',
      },
      encoding: 'utf-8',
      ...childProcessOptions,
    }).toString();
    if (process.env.NX_VERBOSE_LOGGING) {
      console.log(r);
    }
    return r;
  } catch (e) {
    // this is intentional
    // npm ls fails if package is not found
    if (!failOnError && (e.stdout || e.stderr)) {
      return e.stdout?.toString() + e.stderr?.toString();
    }
    throw e;
  }
}

export function getPackageManagerCommand({
  path = tmpProjPath(),
  packageManager = detectPackageManager(path),
} = {}): {
  createWorkspace: string;
  run: (script: string, args: string) => string;
  runNx: string;
  runNxSilent: string;
  runUninstalledPackage: string;
  install: string;
  ciInstall: string;
  addProd: string;
  addDev: string;
  list: string;
  runLerna: string;
} {
  const npmMajorVersion = getNpmMajorVersion();
  const publishedVersion = getPublishedVersion();

  return {
    npm: {
      createWorkspace: `npx ${
        +npmMajorVersion >= 7 ? '--yes' : ''
      } create-nx-workspace@${publishedVersion}`,
      run: (script: string, args: string) => `npm run ${script} -- ${args}`,
      runNx: `npx nx`,
      runNxSilent: `npx nx`,
      runUninstalledPackage: `npx --yes`,
      install: 'npm install',
      ciInstall: 'npm ci',
      addProd: `npm install --legacy-peer-deps`,
      addDev: `npm install --legacy-peer-deps -D`,
      list: 'npm ls --depth 10',
      runLerna: `npx lerna`,
    },
    yarn: {
      // `yarn create nx-workspace` is failing due to wrong global path
      createWorkspace: `yarn global add create-nx-workspace@${publishedVersion} && create-nx-workspace`,
      run: (script: string, args: string) => `yarn ${script} ${args}`,
      runNx: `yarn nx`,
      runNxSilent: `yarn --silent nx`,
      runUninstalledPackage: 'npx --yes',
      install: 'yarn',
      ciInstall: 'yarn --frozen-lockfile',
      addProd: `yarn add`,
      addDev: `yarn add -D`,
      list: 'npm ls --depth 10',
      runLerna: `yarn lerna`,
    },
    // Pnpm 3.5+ adds nx to
    pnpm: {
      createWorkspace: `pnpm dlx create-nx-workspace@${publishedVersion}`,
      run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
      runNx: `pnpm exec nx`,
      runNxSilent: `pnpm exec nx`,
      runUninstalledPackage: 'pnpm dlx',
      install: 'pnpm i',
      ciInstall: 'pnpm install --frozen-lockfile',
      addProd: `pnpm add`,
      addDev: `pnpm add -D`,
      list: 'npm ls --depth 10',
      runLerna: `pnpm exec lerna`,
    },
  }[packageManager.trim() as PackageManager];
}

export function runCypressTests() {
  if (process.env.NX_E2E_RUN_CYPRESS === 'true') {
    ensureCypressInstallation();
    return true;
  } else {
    console.warn(
      'Not running Cypress because NX_E2E_RUN_CYPRESS is not set to true.'
    );
  }
  return false;
}

export function runCommandAsync(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: process['env'],
  }
): Promise<{ stdout: string; stderr: string; combinedOutput: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: opts.cwd || tmpProjPath(),
        env: {
          CI: 'true',
          ...(opts.env || getStrippedEnvironmentVariables()),
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
    encoding: 'utf-8',
    env: {
      CI: 'true',
      ...getStrippedEnvironmentVariables(),
      FORCE_COLOR: 'false',
    },
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

    p.stdout?.on('data', checkCriteria);
    p.stderr?.on('data', checkCriteria);
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
    env: getStrippedEnvironmentVariables(),
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
    env: undefined,
    cwd: tmpProjPath(),
  }
): string {
  try {
    const pmc = getPackageManagerCommand();
    packageInstall(packageName, undefined, version);
    return execSync(pmc.run(`ng g ${packageName}:ng-add`, command ?? ''), {
      cwd: tmpProjPath(),
      stdio: 'pipe',
      env: { ...(opts.env || getStrippedEnvironmentVariables()) },
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
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: undefined,
  }
): string {
  try {
    const pm = getPackageManagerCommand();
    const logs = execSync(`${pm.runNx} ${command}`, {
      cwd: opts.cwd || tmpProjPath(),
      env: { CI: 'true', ...getStrippedEnvironmentVariables(), ...opts.env },
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });
    const r = stripConsoleColors(logs);

    if (isVerbose()) {
      console.log(logs);
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

export function runLernaCLI(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: undefined,
  }
): string {
  try {
    const pm = getPackageManagerCommand();
    const logs = execSync(`${pm.runLerna} ${command}`, {
      cwd: opts.cwd || tmpProjPath(),
      env: { CI: 'true', ...(opts.env || getStrippedEnvironmentVariables()) },
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });
    const r = stripConsoleColors(logs);

    if (isVerbose()) {
      console.log(logs);
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
