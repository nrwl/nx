import { copySync, ensureDirSync, moveSync, removeSync } from 'fs-extra';
import {
  createFile,
  directoryExists,
  tmpBackupNgCliProjPath,
  tmpBackupProjPath,
  updateFile,
  updateJson,
} from './file-utils';
import {
  e2eCwd,
  getLatestLernaVersion,
  getPublishedVersion,
  getSelectedPackageManager,
  isVerbose,
  isVerboseE2ERun,
} from './get-env-info';
import * as isCI from 'is-ci';

import { angularCliVersion as defaultAngularCliVersion } from '@nrwl/workspace/src/utils/versions';
import { dump } from '@zkochan/js-yaml';
import { execSync, ExecSyncOptions } from 'child_process';

import { logError, logInfo } from './log-utils';
import {
  getPackageManagerCommand,
  runCLI,
  RunCmdOpts,
  runCommand,
} from './command-utils';
import { output } from '@nrwl/devkit';
import { readFileSync } from 'fs';
import { join } from 'path';

let projName: string;

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newProject({
  name = uniq('proj'),
  packageManager = getSelectedPackageManager(),
} = {}): string {
  try {
    const projScope = 'proj';

    if (!directoryExists(tmpBackupProjPath())) {
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

      // TODO(jack): we should tag the projects (e.g. tags: ['package']) and filter from that rather than hard-code packages.
      const packages = [
        `@nrwl/angular`,
        `@nrwl/eslint-plugin-nx`,
        `@nrwl/express`,
        `@nrwl/esbuild`,
        `@nrwl/jest`,
        `@nrwl/js`,
        `@nrwl/linter`,
        `@nrwl/nest`,
        `@nrwl/next`,
        `@nrwl/node`,
        `@nrwl/nx-plugin`,
        `@nrwl/rollup`,
        `@nrwl/react`,
        `@nrwl/storybook`,
        `@nrwl/vite`,
        `@nrwl/web`,
        `@nrwl/webpack`,
        `@nrwl/react-native`,
        `@nrwl/expo`,
      ];
      packageInstall(packages.join(` `), projScope);

      // stop the daemon
      execSync(`${getPackageManagerCommand().runNx} reset`, {
        cwd: `${e2eCwd}/proj`,
        stdio: isVerbose() ? 'inherit' : 'pipe',
      });

      moveSync(`${e2eCwd}/proj`, `${tmpBackupProjPath()}`);
    }
    projName = name;
    copySync(`${tmpBackupProjPath()}`, `${tmpProjPath()}`);

    if (isVerbose()) {
      logInfo(`NX`, `E2E created a project: ${tmpProjPath()}`);
    }
    if (packageManager === 'pnpm') {
      execSync(getPackageManagerCommand().install, {
        cwd: tmpProjPath(),
        stdio: 'pipe',
        env: { CI: 'true', ...process.env },
        encoding: 'utf-8',
      });
    }
    return projScope;
  } catch (e) {
    logError(`Failed to set up project for e2e tests.`, e.message);
    throw e;
  }
}

// pnpm v7 sadly doesn't automatically install peer dependencies
export function addPnpmRc() {
  updateFile(
    '.npmrc',
    'strict-peer-dependencies=false\nauto-install-peers=true'
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
    extraArgs,
    ci,
    useDetectedPm = false,
    cwd = e2eCwd,
    bundler,
    routing,
    standaloneApi,
  }: {
    preset: string;
    appName?: string;
    style?: string;
    base?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    extraArgs?: string;
    ci?: 'azure' | 'github' | 'circleci';
    useDetectedPm?: boolean;
    cwd?: string;
    bundler?: 'webpack' | 'vite';
    standaloneApi?: boolean;
    routing?: boolean;
  }
) {
  projName = name;

  const pm = getPackageManagerCommand({ packageManager });

  let command = `${pm.createWorkspace} ${name} --preset=${preset} --no-nxCloud --no-interactive`;
  if (appName) {
    command += ` --appName=${appName}`;
  }
  if (style) {
    command += ` --style=${style}`;
  }
  if (ci) {
    command += ` --ci=${ci}`;
  }

  if (bundler) {
    command += ` --bundler=${bundler}`;
  }

  if (standaloneApi !== undefined) {
    command += ` --standaloneApi=${standaloneApi}`;
  }

  if (routing !== undefined) {
    command += ` --routing=${routing}`;
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

  try {
    const create = execSync(`${command}${isVerbose() ? ' --verbose' : ''}`, {
      cwd,
      stdio: 'pipe',
      env: { CI: 'true', ...process.env },
      encoding: 'utf-8',
    });

    if (isVerbose()) {
      output.log({
        title: `Command: ${command}`,
        bodyLines: [create as string],
        color: 'green',
      });
    }

    return create;
  } catch (e) {
    logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
    throw e;
  }
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

  try {
    const create = execSync(`${command}${isVerbose() ? ' --verbose' : ''}`, {
      cwd: e2eCwd,
      stdio: 'pipe',
      env: process.env,
      encoding: 'utf-8',
    });

    if (isVerbose()) {
      output.log({
        title: `Command: ${command}`,
        bodyLines: [create as string],
        color: 'green',
      });
    }

    return create;
  } catch (e) {
    logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
    throw e;
  }
}

export function packageInstall(
  pkg: string,
  projName?: string,
  version = getPublishedVersion(),
  mode: 'dev' | 'prod' = 'dev'
) {
  const cwd = projName ? `${e2eCwd}/${projName}` : tmpProjPath();
  const pm = getPackageManagerCommand({ path: cwd });
  const pkgsWithVersions = pkg
    .split(' ')
    .map((pgk) => `${pgk}@${version}`)
    .join(' ');

  const command = `${
    mode === 'dev' ? pm.addDev : pm.addProd
  } ${pkgsWithVersions}${isVerbose() ? ' --verbose' : ''}`;

  try {
    const install = execSync(
      `${mode === 'dev' ? pm.addDev : pm.addProd} ${pkgsWithVersions}${
        isVerbose() ? ' --verbose' : ''
      }`,
      {
        cwd,
        stdio: 'pipe',
        env: process.env,
        encoding: 'utf-8',
      }
    );

    if (isVerbose()) {
      output.log({
        title: `Command: ${command}`,
        bodyLines: [install as string],
        color: 'green',
      });
    }

    return install;
  } catch (e) {
    logError(`Original command: ${command}`, `${e.stdout}\n\n${e.stderr}`);
    throw e;
  }
}

/**
 * Creates a new Angular CLI workspace or restores a cached one if exists.
 * @returns the workspace name
 */
export function runNgNew(
  packageManager = getSelectedPackageManager(),
  angularCliVersion = defaultAngularCliVersion
): string {
  const pmc = getPackageManagerCommand({ packageManager });

  if (directoryExists(tmpBackupNgCliProjPath())) {
    const angularJson = JSON.parse(
      readFileSync(join(tmpBackupNgCliProjPath(), 'angular.json'), 'utf-8')
    );
    // the name of the workspace matches the name of the generated default app,
    // we need to reuse the same name that's cached in order to avoid issues
    // with tests relying on a different name
    projName = Object.keys(angularJson.projects)[0];
    copySync(tmpBackupNgCliProjPath(), tmpProjPath());

    if (isVerboseE2ERun()) {
      logInfo(
        `NX`,
        `E2E restored an Angular CLI project from cache: ${tmpProjPath()}`
      );
    }

    return projName;
  }

  projName = uniq('ng-proj');
  const command = `${pmc.runUninstalledPackage} @angular/cli@${angularCliVersion} new ${projName} --package-manager=${packageManager}`;
  execSync(command, {
    cwd: e2eCwd,
    stdio: isVerbose() ? 'inherit' : 'pipe',
    env: process.env,
    encoding: 'utf-8',
  });
  copySync(tmpProjPath(), tmpBackupNgCliProjPath());

  if (isVerboseE2ERun()) {
    logInfo(`NX`, `E2E created an Angular CLI project: ${tmpProjPath()}`);
  }

  return projName;
}

export function newLernaWorkspace({
  name = uniq('lerna-proj'),
  packageManager = getSelectedPackageManager(),
} = {}): string {
  try {
    const projScope = name;
    projName = name;

    const pm = getPackageManagerCommand({ packageManager });

    createNonNxProjectDirectory(projScope, packageManager !== 'pnpm');

    if (packageManager === 'pnpm') {
      updateFile(
        'pnpm-workspace.yaml',
        dump({
          packages: ['packages/*'],
        })
      );
      updateFile(
        '.npmrc',
        'prefer-frozen-lockfile=false\nstrict-peer-dependencies=false\nauto-install-peers=true'
      );
    }

    if (isVerbose()) {
      logInfo(`NX`, `E2E test has created a lerna workspace: ${tmpProjPath()}`);
    }

    // We need to force the real latest version of lerna to depend on our locally published version of nx
    updateJson(`package.json`, (json) => {
      // yarn workspaces can only be enabled in private projects
      json.private = true;

      const nxVersion = getPublishedVersion();
      const overrides = {
        ...json.overrides,
        nx: nxVersion,
        '@nrwl/devkit': nxVersion,
      };
      if (packageManager === 'pnpm') {
        json.pnpm = {
          ...json.pnpm,
          overrides: {
            ...json.pnpm?.overrides,
            ...overrides,
          },
        };
      } else if (packageManager === 'yarn') {
        json.resolutions = {
          ...json.resolutions,
          ...overrides,
        };
      } else {
        json.overrides = overrides;
      }
      return json;
    });

    /**
     * Again, in order to ensure we override the required version relationships, we first install lerna as a devDep
     * before running `lerna init`.
     */
    execSync(
      `${pm.addDev} lerna@${getLatestLernaVersion()}${
        packageManager === 'pnpm'
          ? ' --workspace-root'
          : packageManager === 'yarn'
          ? ' -W'
          : ''
      }`,
      {
        cwd: tmpProjPath(),
        stdio: isVerbose() ? 'inherit' : 'pipe',
        env: { CI: 'true', ...process.env },
        encoding: 'utf-8',
      }
    );

    execSync(`${pm.runLerna} init`, {
      cwd: tmpProjPath(),
      stdio: isVerbose() ? 'inherit' : 'pipe',
      env: { CI: 'true', ...process.env },
      encoding: 'utf-8',
    });

    execSync(pm.install, {
      cwd: tmpProjPath(),
      stdio: isVerbose() ? 'inherit' : 'pipe',
      env: { CI: 'true', ...process.env },
      encoding: 'utf-8',
    });

    return projScope;
  } catch (e) {
    logError(`Failed to set up lerna workspace for e2e tests.`, e.message);
    throw e;
  }
}

export function newWrappedNxWorkspace({
  name = uniq('wrapped'),
  pmc = getPackageManagerCommand(),
} = {}): (command: string, opts?: Partial<ExecSyncOptions>) => string {
  projName = name;
  ensureDirSync(tmpProjPath());
  runCommand(
    `${pmc.runUninstalledPackage} nx@latest init --use-dot-nx-installation`
  );
  return (command: string, opts: Partial<ExecSyncOptions> | undefined) => {
    if (process.platform === 'win32') {
      return runCommand(`./nx.bat ${command}`, { ...opts, failOnError: true });
    } else {
      return runCommand(`./nx ${command}`, { ...opts, failOnError: true });
    }
  };
}

export function getProjectName(): string {
  return projName;
}

export function tmpProjPath(path?: string) {
  return path ? `${e2eCwd}/${projName}/${path}` : `${e2eCwd}/${projName}`;
}

export function createNonNxProjectDirectory(
  name = uniq('proj'),
  addWorkspaces = true
) {
  projName = name;
  ensureDirSync(tmpProjPath());
  createFile(
    'package.json',
    JSON.stringify({
      name,
      workspaces: addWorkspaces ? ['packages/*'] : undefined,
    })
  );
}

export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

// Useful in order to cleanup space during CI to prevent `No space left on device` exceptions
export function cleanupProject({
  skipReset,
  ...opts
}: RunCmdOpts & { skipReset?: boolean } = {}) {
  if (isCI) {
    // Stopping the daemon is not required for tests to pass, but it cleans up background processes
    if (!skipReset) {
      runCLI('reset', opts);
    }
    try {
      removeSync(tmpProjPath());
    } catch (e) {}
  }
}
