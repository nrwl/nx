import {
  output,
  PackageManager,
  ProjectConfiguration,
  TargetConfiguration,
} from '@nx/devkit';
import { ChildProcess, exec, execSync, ExecSyncOptions } from 'child_process';
import { existsSync } from 'fs-extra';
import * as isCI from 'is-ci';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { gte } from 'semver';
import { packageInstall, tmpProjPath } from './create-project-utils';
import {
  ensureCypressInstallation,
  ensurePlaywrightBrowsersInstallation,
} from './ensure-browser-installation';
import { fileExists, readJson, updateJson } from './file-utils';
import {
  detectPackageManager,
  getNpmMajorVersion,
  getPnpmVersion,
  getPublishedVersion,
  getStrippedEnvironmentVariables,
  getYarnMajorVersion,
  isVerboseE2ERun,
} from './get-env-info';
import { logError, logInfo } from './log-utils';

export interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string | undefined>;
  cwd?: string;
  silent?: boolean;
  verbose?: boolean;
  redirectStderr?: boolean;
  timeout?: number;
  /** Override daemon mode for this call. Defaults to `true`; set `false` to exercise the non-daemon path. */
  daemon?: boolean;
}

/**
 * Caps maxWorkers in CI for node/web/jest builds so they don't spawn ~34 workers.
 */
export function setMaxWorkers(projectJsonPath: string) {
  if (isCI) {
    updateJson<ProjectConfiguration>(projectJsonPath, (project) => {
      const { build } = project.targets as {
        [targetName: string]: TargetConfiguration<any>;
      };

      if (!build) {
        return project;
      }

      const executor = build.executor as string;
      if (
        executor.startsWith('@nx/node') ||
        executor.startsWith('@nx/web') ||
        executor.startsWith('@nx/jest')
      ) {
        build.options.maxWorkers = 4;
      }

      return project;
    });
  }
}

export function runCommand(
  command: string,
  options?: Partial<ExecSyncOptions> & { failOnError?: boolean }
): string {
  const {
    failOnError,
    env: optionsEnv,
    ...childProcessOptions
  } = options ?? {};
  try {
    const r = execSync(command, {
      cwd: tmpProjPath(),
      stdio: 'pipe',
      env: {
        // Use new versioning by default in e2e tests
        NX_INTERNAL_USE_LEGACY_VERSIONING: 'false',
        ...getStrippedEnvironmentVariables(),
        ...optionsEnv,
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

    return stripVTControlCharacters(r as string);
  } catch (e) {
    // Intentional: some commands (e.g. `npm ls`) exit non-zero but still produce useful output.
    logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
    if (!failOnError && (e.stdout || e.stderr)) {
      return stripVTControlCharacters(e.stdout + e.stderr);
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
  exec: string;
} {
  const npmMajorVersion = getNpmMajorVersion();
  const yarnMajorVersion = getYarnMajorVersion(path);
  const pnpmVersion = getPnpmVersion();
  const publishedVersion = getPublishedVersion();
  const isYarnWorkspace = fileExists(join(path, 'package.json'))
    ? readJson('package.json').workspaces
    : false;
  const isPnpmWorkspace = existsSync(join(path, 'pnpm-workspace.yaml'));

  return {
    npm: {
      createWorkspace: `npx ${
        npmMajorVersion && +npmMajorVersion >= 7 ? '--yes' : ''
      } create-nx-workspace@${publishedVersion}`,
      run: (script: string, args: string) => `npm run ${script} -- ${args}`,
      runNx: `npx nx`,
      runNxSilent: `npx nx`,
      runUninstalledPackage: `npx --yes`,
      install: 'npm install',
      ciInstall: 'npm ci',
      addProd: `npm install`,
      addDev: `npm install -D`,
      list: 'npm ls --depth 10',
      runLerna: `npx lerna`,
      exec: 'npx',
    },
    yarn: {
      createWorkspace: `npx ${
        npmMajorVersion && +npmMajorVersion >= 7 ? '--yes' : ''
      } create-nx-workspace@${publishedVersion}`,
      run: (script: string, args: string) => `yarn ${script} ${args}`,
      runNx: `yarn nx`,
      runNxSilent:
        yarnMajorVersion && +yarnMajorVersion >= 2
          ? 'yarn nx'
          : `yarn --silent nx`,
      runUninstalledPackage: 'npx --yes',
      install: 'yarn',
      ciInstall: 'yarn --frozen-lockfile',
      addProd: isYarnWorkspace ? 'yarn add -W' : 'yarn add',
      addDev: isYarnWorkspace ? 'yarn add -DW' : 'yarn add -D',
      list: 'yarn list --pattern',
      runLerna:
        yarnMajorVersion && +yarnMajorVersion >= 2
          ? 'yarn lerna'
          : `yarn --silent lerna`,
      exec: 'yarn',
    },
    pnpm: {
      createWorkspace: `pnpm dlx create-nx-workspace@${publishedVersion}`,
      run: (script: string, args: string) => `pnpm run ${script} -- ${args}`,
      runNx: `pnpm exec nx`,
      runNxSilent: `pnpm exec nx`,
      runUninstalledPackage: 'pnpm dlx',
      // --no-frozen-lockfile: pnpm detects CI and would otherwise default to --frozen-lockfile.
      install: 'pnpm install --no-frozen-lockfile',
      ciInstall: 'pnpm install --frozen-lockfile',
      addProd: isPnpmWorkspace ? 'pnpm add -w' : 'pnpm add',
      addDev: isPnpmWorkspace ? 'pnpm add -Dw' : 'pnpm add -D',
      list: 'pnpm ls --depth 10',
      runLerna: `pnpm exec lerna`,
      exec: pnpmVersion && gte(pnpmVersion, '6.13.0') ? 'pnpm exec' : 'pnpx',
    },
    bun: {
      // See note in runCreateWorkspace in create-project-utils.ts for why we don't set @{version} for `bunx create-nx-workspace` right now
      createWorkspace: `bunx create-nx-workspace`,
      run: (script: string, args: string) => `bun run ${script} -- ${args}`,
      runNx: `bunx nx`,
      runNxSilent: `bunx nx`,
      runUninstalledPackage: `bunx --yes`,
      install: 'bun install',
      ciInstall: 'bun install --no-cache',
      addProd: 'bun install',
      addDev: 'bun install -D',
      list: 'bun pm ls',
      runLerna: `bunx lerna`,
      exec: 'bun',
    },
  }[packageManager.trim() as PackageManager];
}

export function runE2ETests(runner?: 'cypress' | 'playwright') {
  if (process.env.NX_E2E_RUN_E2E === 'true') {
    if (!runner || runner === 'cypress') {
      ensureCypressInstallation();
    }
    if (!runner || runner === 'playwright') {
      ensurePlaywrightBrowsersInstallation();
    }
    return true;
  }

  console.warn(
    'Not running E2E tests because NX_E2E_RUN_E2E is not set to true.'
  );

  if (process.env.NX_E2E_RUN_CYPRESS) {
    console.warn(
      'NX_E2E_RUN_CYPRESS is deprecated, use NX_E2E_RUN_E2E instead.'
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
          // Force daemon on under CI (matches runCLI); override via opts.daemon = false.
          NX_DAEMON: opts.daemon === false ? 'false' : 'true',
          // Use new versioning by default in e2e tests
          NX_INTERNAL_USE_LEGACY_VERSIONING: 'false',
          ...(opts.env || getStrippedEnvironmentVariables()),
          FORCE_COLOR: 'false',
        },
        encoding: 'utf-8',
      },
      (err, stdout, stderr) => {
        if (!opts.silenceError && err) {
          logError(`Original command: ${command}`, `${stdout}\n\n${stderr}`);
          reject(err);
        }

        const outputs = {
          stdout: stripVTControlCharacters(stdout),
          stderr: stripVTControlCharacters(stderr),
          combinedOutput: stripVTControlCharacters(`${stdout}${stderr}`),
        };

        if (opts.verbose ?? isVerboseE2ERun()) {
          output.log({
            title: `Original command: ${command}`,
            bodyLines: [outputs.combinedOutput],
            color: 'green',
          });
        }

        resolve(outputs);
      }
    );
  });
}

export function runCommandUntil(
  command: string,
  criteria: (output: string) => boolean,
  opts: RunCmdOpts & { timeout?: number } = {}
): Promise<ChildProcess> {
  const pm = getPackageManagerCommand();
  const timeout = opts.timeout ?? 30_000;
  const p = exec(`${pm.runNx} ${command}`, {
    cwd: tmpProjPath(),
    encoding: 'utf-8',
    env: {
      CI: 'true',
      NX_DAEMON: 'true',
      // Use new versioning by default in e2e tests
      NX_INTERNAL_USE_LEGACY_VERSIONING: 'false',
      ...getStrippedEnvironmentVariables(),
      ...opts.env,
      FORCE_COLOR: 'false',
    },
    windowsHide: false,
  });
  return new Promise((res, rej) => {
    let output = '';
    let complete = false;

    const timeoutId = setTimeout(() => {
      if (!complete) {
        complete = true;
        p.kill();
        logError(
          `Output did not meet the criteria:`,
          output
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
        rej(new Error(`Timed out after ${timeout}ms waiting for criteria`));
      }
    }, timeout);

    function checkCriteria(c) {
      output += c.toString();
      const strippedOutput = stripVTControlCharacters(output);
      if (criteria(strippedOutput) && !complete) {
        complete = true;
        clearTimeout(timeoutId);
        res(p);
      }
    }

    p.stdout?.on('data', checkCriteria);
    p.stderr?.on('data', checkCriteria);
    p.on('close', (code) => {
      if (!complete) {
        complete = true;
        clearTimeout(timeoutId);
        logError(
          `Original output:`,
          output
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
        rej(new Error(`Exited with ${code}`));
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
  const commandToRun = `${opts.silent ? pm.runNxSilent : pm.runNx} ${command} ${
    (opts.verbose ?? isVerboseE2ERun()) ? ' --verbose' : ''
  }${opts.redirectStderr ? ' 2>&1' : ''}`;

  return runCommandAsync(commandToRun, opts);
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

    const r = stripVTControlCharacters(result);

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

/**
 * Replaces the run-to-run durations / core counts in Nx's performance report with
 * stable placeholders so the report can stay in snapshots. Scoped to the report
 * block (between `Run duration:` and the `Learn how to improve …` footer); no-op
 * when no report is present.
 */
export function normalizePerformanceReport(output: string): string {
  return output.replace(
    /\n[ \t]*Run duration:[\s\S]*?Learn how to improve your run's performance → \S+/g,
    (block) =>
      block
        // Durations: match the minute form ("1m 30s") first so its "30s" isn't matched alone.
        .replace(/\b\d+m \d+s\b|\b\d+(?:\.\d+)?m?s\b/g, '{DURATION}')
        .replace(/\b\d+(?= cores?\b)/g, '{CORES}')
        // Longest-tasks list right-aligns durations (padStart); collapse the varying
        // id→duration gap back to a fixed 4-space separator so the table is deterministic.
        .replace(/^([ \t]+\S+) {4,}(\{DURATION\})$/gm, '$1    $2')
        // Stat rows align values by padding the label column, whose width may change;
        // collapse the label→value gap so the snapshot doesn't depend on that padding.
        .replace(
          /^([ \t]*(?:Run duration|Cache|Critical path|Recoverable time):) +/gm,
          '$1 '
        )
  );
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
  const timeoutMs = opts.timeout ?? 5 * 60 * 1000;
  try {
    const pm = getPackageManagerCommand();
    const commandToRun = `${pm.runNxSilent} ${command} ${
      (opts.verbose ?? isVerboseE2ERun()) ? ' --verbose' : ''
    }${opts.redirectStderr ? ' 2>&1' : ''}`;
    logInfo(`Run Command: ${command}`);
    const startTime = performance.now();
    const result = execSync(commandToRun, {
      cwd: opts.cwd || tmpProjPath(),
      env: {
        CI: 'true',
        // Daemon is normally off under CI; force it on so e2e exercises the same
        // daemon-driven graph + watcher path real users hit. Override via opts.daemon = false.
        NX_DAEMON: opts.daemon === false ? 'false' : 'true',
        // Use new versioning by default in e2e tests
        NX_INTERNAL_USE_LEGACY_VERSIONING: 'false',
        ...getStrippedEnvironmentVariables(),
        ...opts.env,
      },
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs,
    });
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    logInfo(`Run Command: ${command} (${elapsed}s)`);

    if (opts.verbose ?? isVerboseE2ERun()) {
      output.log({
        title: `Original command: ${command}`,
        bodyLines: [result as string],
        color: 'green',
      });
    }

    const r = stripVTControlCharacters(result);

    runCLI.lastExitCode = 0;
    return r;
  } catch (e) {
    if (e.killed || e.signal) {
      const timeoutSec = Math.round(timeoutMs / 1000);
      const processOutput = stripVTControlCharacters(
        `${e.stdout ?? ''}\n\n${e.stderr ?? ''}`
      ).trim();
      const msg = `Command timed out after ${timeoutSec}s: ${command}\n\nProcess output:\n${processOutput}`;
      logError(`Command timed out`, msg);
      throw new Error(msg);
    }
    if (opts.silenceError) {
      runCLI.lastExitCode = (e.status ?? 1) as number;
      // Without redirectStderr the shell didn't merge stderr into stdout, so concat both.
      const output = opts.redirectStderr ? e.stdout : e.stdout + e.stderr;
      return stripVTControlCharacters(output);
    } else {
      logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
      throw e;
    }
  }
}
runCLI.lastExitCode = 0 as number;

export function runLernaCLI(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: undefined,
  }
): string {
  const timeoutMs = opts.timeout ?? 2 * 60 * 1000;
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
      timeout: timeoutMs,
    });

    if (opts.verbose ?? isVerboseE2ERun()) {
      output.log({
        title: `Original command: ${fullCommand}`,
        bodyLines: [logs as string],
        color: 'green',
      });
    }
    const r = stripVTControlCharacters(logs);

    return r;
  } catch (e) {
    if (e.killed || e.signal) {
      const timeoutSec = Math.round(timeoutMs / 1000);
      const processOutput = stripVTControlCharacters(
        `${e.stdout ?? ''}\n\n${e.stderr ?? ''}`
      ).trim();
      const msg = `Command timed out after ${timeoutSec}s: ${command}\n\nProcess output:\n${processOutput}`;
      logError(`Command timed out`, msg);
      throw new Error(msg);
    }
    if (opts.silenceError) {
      return stripVTControlCharacters(e.stdout + e.stderr);
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

export function isDockerAvailable() {
  try {
    const dockerVersionInfo = runCommand(`docker info -f json`);
    return !dockerVersionInfo.includes('Cannot connect to the Docker daemon');
  } catch {
    return false;
  }
}
