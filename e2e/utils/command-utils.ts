import { output, PackageManager } from '@nx/devkit';
import { packageInstall, tmpProjPath } from './create-project-utils';
import {
  detectPackageManager,
  ensureCypressInstallation,
  getNpmMajorVersion,
  getPublishedVersion,
  getStrippedEnvironmentVariables,
  isVerboseE2ERun,
} from './get-env-info';
import { TargetConfiguration } from '@nx/devkit';
import { ChildProcess, exec, execSync, ExecSyncOptions } from 'child_process';
import { join } from 'path';
import * as isCI from 'is-ci';
import { Workspaces } from '../../packages/nx/src/config/workspaces';
import { fileExists, readJson, updateFile } from './file-utils';
import { logError, stripConsoleColors } from './log-utils';
import { existsSync } from 'fs-extra';

export interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string | undefined>;
  cwd?: string;
  silent?: boolean;
  verbose?: boolean;
  redirectStderr?: boolean;
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
        executor.startsWith('@nx/node') ||
        executor.startsWith('@nx/web') ||
        executor.startsWith('@nx/jest')
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
      stdio: 'pipe',
      env: {
        ...getStrippedEnvironmentVariables(),
        ...childProcessOptions?.env,
        FORCE_COLOR: 'false',
      },
      encoding: 'utf-8',
      ...childProcessOptions,
    });

    if (isVerboseE2ERun()) {
      output.log({
        title: `Command: ${command}`,
        bodyLines: [r as string],
        color: 'green',
      });
    }

    return r as string;
  } catch (e) {
    // this is intentional
    // npm ls fails if package is not found
    logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
    if (!failOnError && (e.stdout || e.stderr)) {
      return e.stdout + e.stderr;
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
  const isYarnWorkspace = fileExists(join(path, 'package.json'))
    ? readJson('package.json').workspaces
    : false;
  const isPnpmWorkspace = existsSync(join(path, 'pnpm-workspace.yaml'));

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
      createWorkspace: `npx ${
        +npmMajorVersion >= 7 ? '--yes' : ''
      } create-nx-workspace@${publishedVersion}`,
      run: (script: string, args: string) => `yarn ${script} ${args}`,
      runNx: `yarn nx`,
      runNxSilent: `yarn --silent nx`,
      runUninstalledPackage: 'npx --yes',
      install: 'yarn',
      ciInstall: 'yarn --frozen-lockfile',
      addProd: isYarnWorkspace ? 'yarn add -W' : 'yarn add',
      addDev: isYarnWorkspace ? 'yarn add -DW' : 'yarn add -D',
      list: 'yarn list --pattern',
      runLerna: `yarn --silent lerna`,
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
      addProd: isPnpmWorkspace ? 'pnpm add -w' : 'pnpm add',
      addDev: isPnpmWorkspace ? 'pnpm add -Dw' : 'pnpm add -D',
      list: 'pnpm ls --depth 10',
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
        logError(
          `Original output:`,
          output
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
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
    const fullCommand = pmc.run(`ng g ${packageName}:ng-add`, command ?? '');
    const result = execSync(fullCommand, {
      cwd: tmpProjPath(),
      stdio: 'pipe',
      env: { ...(opts.env || getStrippedEnvironmentVariables()) },
      encoding: 'utf-8',
    });

    const r = stripConsoleColors(result);

    if (opts.verbose ?? isVerboseE2ERun()) {
      output.log({
        title: `Original command: ${fullCommand}`,
        bodyLines: [result as string],
        color: 'green',
      });
    }

    return r;
  } catch (e) {
    if (opts.silenceError) {
      return e.stdout;
    } else {
      logError(`Ng Add failed: ${command}`, `${e.stdout}\n\n${e.stderr}`);
      throw e;
    }
  }
}

export function runCLI(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: undefined,
    verbose: undefined,
    redirectStderr: undefined,
  }
): string {
  try {
    const pm = getPackageManagerCommand();
    const commandToRun = `${pm.runNxSilent} ${command} ${
      opts.verbose ?? isVerboseE2ERun() ? ' --verbose' : ''
    }${opts.redirectStderr ? ' 2>&1' : ''}`;
    const logs = execSync(commandToRun, {
      cwd: opts.cwd || tmpProjPath(),
      env: {
        CI: 'true',
        ...getStrippedEnvironmentVariables(),
        ...opts.env,
      },
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });

    if (opts.verbose ?? isVerboseE2ERun()) {
      output.log({
        title: `Original command: ${command}`,
        bodyLines: [logs as string],
        color: 'green',
      });
    }

    const r = stripConsoleColors(logs);
    const needsMaxWorkers = /g.*(express|nest|node|web|react):app.*/;
    if (needsMaxWorkers.test(command)) {
      setMaxWorkers();
    }

    return r;
  } catch (e) {
    if (opts.silenceError) {
      return stripConsoleColors(e.stdout + e.stderr);
    } else {
      logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
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
    const fullCommand = `${pm.runLerna} ${command}`;
    const logs = execSync(fullCommand, {
      cwd: opts.cwd || tmpProjPath(),
      env: {
        CI: 'true',
        ...(opts.env || getStrippedEnvironmentVariables()),
      },
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
    });

    if (opts.verbose ?? isVerboseE2ERun()) {
      output.log({
        title: `Original command: ${fullCommand}`,
        bodyLines: [logs as string],
        color: 'green',
      });
    }
    const r = stripConsoleColors(logs);

    return r;
  } catch (e) {
    if (opts.silenceError) {
      return stripConsoleColors(e.stdout + e.stderr);
    } else {
      logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
      throw e;
    }
  }
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
