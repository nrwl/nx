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

import { angularCliVersion as defaultAngularCliVersion } from '@nx/workspace/src/utils/versions';
import { dump } from '@zkochan/js-yaml';
import { execSync, ExecSyncOptions } from 'child_process';

import { performance, PerformanceMeasure } from 'perf_hooks';
import { logError, logInfo } from './log-utils';
import {
  getPackageManagerCommand,
  runCLI,
  RunCmdOpts,
  runCommand,
} from './command-utils';
import { output, readJsonFile } from '@nx/devkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resetWorkspaceContext } from 'nx/src/utils/workspace-context';

let projName: string;

// TODO(jack): we should tag the projects (e.g. tags: ['package']) and filter from that rather than hard-code packages.
const nxPackages = [
  `@nx/angular`,
  `@nx/cypress`,
  `@nx/eslint-plugin`,
  `@nx/express`,
  `@nx/esbuild`,
  `@nx/gradle`,
  `@nx/jest`,
  `@nx/js`,
  `@nx/eslint`,
  `@nx/nest`,
  `@nx/next`,
  `@nx/node`,
  `@nx/nuxt`,
  `@nx/plugin`,
  `@nx/playwright`,
  `@nx/rollup`,
  `@nx/react`,
  `@nx/remix`,
  `@nx/storybook`,
  `@nx/vue`,
  `@nx/vite`,
  `@nx/web`,
  `@nx/webpack`,
  `@nx/react-native`,
  `@nx/expo`,
] as const;

type NxPackage = (typeof nxPackages)[number];

/**
 * Sets up a new project in the temporary project path
 * for the currently selected CLI.
 */
export function newProject({
  name = uniq('proj'),
  packageManager = getSelectedPackageManager(),
  unsetProjectNameAndRootFormat = true,
  packages,
}: {
  name?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  unsetProjectNameAndRootFormat?: boolean;
  readonly packages?: Array<NxPackage>;
} = {}): string {
  const newProjectStart = performance.mark('new-project:start');
  try {
    const projScope = 'proj';

    let createNxWorkspaceMeasure: PerformanceMeasure;
    let packageInstallMeasure: PerformanceMeasure;

    if (!directoryExists(tmpBackupProjPath())) {
      const createNxWorkspaceStart = performance.mark(
        'create-nx-workspace:start'
      );
      runCreateWorkspace(projScope, {
        preset: 'apps',
        packageManager,
      });
      const createNxWorkspaceEnd = performance.mark('create-nx-workspace:end');
      createNxWorkspaceMeasure = performance.measure(
        'create-nx-workspace',
        createNxWorkspaceStart.name,
        createNxWorkspaceEnd.name
      );

      if (unsetProjectNameAndRootFormat) {
        console.warn(
          'ATTENTION: The workspace generated for this e2e test does not use the new as-provided project name/root format. Please update this test'
        );
        createFile('apps/.gitkeep');
        createFile('libs/.gitkeep');
      }

      // Temporary hack to prevent installing with `--frozen-lockfile`
      if (isCI && packageManager === 'pnpm') {
        updateFile(
          '.npmrc',
          'prefer-frozen-lockfile=false\nstrict-peer-dependencies=false\nauto-install-peers=true'
        );
      }

      if (!packages) {
        console.warn(
          'ATTENTION: All packages are installed into the new workspace. To make this test faster, please pass the subset of packages that this test needs by passing a packages array in the options'
        );
      }
      const packageInstallStart = performance.mark('packageInstall:start');
      packageInstall((packages ?? nxPackages).join(` `), projScope);
      const packageInstallEnd = performance.mark('packageInstall:end');
      packageInstallMeasure = performance.measure(
        'packageInstall',
        packageInstallStart.name,
        packageInstallEnd.name
      );
      // stop the daemon
      execSync(`${getPackageManagerCommand().runNx} reset`, {
        cwd: `${e2eCwd}/proj`,
        stdio: isVerbose() ? 'inherit' : 'pipe',
      });

      moveSync(`${e2eCwd}/proj`, `${tmpBackupProjPath()}`);
    }
    projName = name;

    const projectDirectory = tmpProjPath();
    copySync(`${tmpBackupProjPath()}`, `${projectDirectory}`);

    const dependencies = readJsonFile(
      `${projectDirectory}/package.json`
    ).devDependencies;
    const missingPackages = (packages || []).filter((p) => !dependencies[p]);

    if (missingPackages.length > 0) {
      packageInstall(missingPackages.join(` `), projName);
    } else if (packageManager === 'pnpm') {
      // pnpm creates sym links to the pnpm store,
      // we need to run the install again after copying the temp folder
      execSync(getPackageManagerCommand().install, {
        cwd: projectDirectory,
        stdio: 'pipe',
        env: { CI: 'true', ...process.env },
        encoding: 'utf-8',
      });
    }

    const newProjectEnd = performance.mark('new-project:end');
    const perfMeasure = performance.measure(
      'newProject',
      newProjectStart.name,
      newProjectEnd.name
    );

    if (isVerbose()) {
      logInfo(
        `NX`,
        `E2E created a project: ${projectDirectory} in ${
          perfMeasure.duration / 1000
        } seconds
${
  createNxWorkspaceMeasure
    ? `create-nx-workspace: ${
        createNxWorkspaceMeasure.duration / 1000
      } seconds\n`
    : ''
}${
          packageInstallMeasure
            ? `packageInstall: ${
                packageInstallMeasure.duration / 1000
              } seconds\n`
            : ''
        }`
      );
    }

    if (process.env.NX_E2E_EDITOR) {
      const editor = process.env.NX_E2E_EDITOR;
      execSync(`${editor} ${projectDirectory}`, {
        stdio: 'inherit',
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
    useDetectedPm = false,
    cwd = e2eCwd,
    bundler,
    routing,
    standaloneApi,
    docker,
    nextAppDir,
    nextSrcDir,
    e2eTestRunner,
    ssr,
    framework,
    prefix,
  }: {
    preset: string;
    appName?: string;
    style?: string;
    base?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
    extraArgs?: string;
    useDetectedPm?: boolean;
    cwd?: string;
    bundler?: 'webpack' | 'vite';
    standaloneApi?: boolean;
    routing?: boolean;
    docker?: boolean;
    nextAppDir?: boolean;
    nextSrcDir?: boolean;
    e2eTestRunner?: 'cypress' | 'playwright' | 'jest' | 'detox' | 'none';
    ssr?: boolean;
    framework?: string;
    prefix?: string;
  }
) {
  projName = name;

  const pm = getPackageManagerCommand({ packageManager });

  let command = `${pm.createWorkspace} ${name} --preset=${preset} --nxCloud=skip --no-interactive`;
  if (appName) {
    command += ` --appName=${appName}`;
  }
  if (style) {
    command += ` --style=${style}`;
  }

  if (bundler) {
    command += ` --bundler=${bundler}`;
  }

  if (nextAppDir !== undefined) {
    command += ` --nextAppDir=${nextAppDir}`;
  }

  if (nextSrcDir !== undefined) {
    command += ` --nextSrcDir=${nextSrcDir}`;
  }

  if (docker !== undefined) {
    command += ` --docker=${docker}`;
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

  if (e2eTestRunner) {
    command += ` --e2eTestRunner=${e2eTestRunner}`;
  }

  if (framework) {
    command += ` --framework=${framework}`;
  }

  if (extraArgs) {
    command += ` ${extraArgs}`;
  }

  if (isCI) {
    command += ` --verbose`;
  }

  if (ssr !== undefined) {
    command += ` --ssr=${ssr}`;
  }

  if (prefix !== undefined) {
    command += ` --prefix=${prefix}`;
  }

  try {
    const create = execSync(`${command}${isVerbose() ? ' --verbose' : ''}`, {
      cwd,
      stdio: 'pipe',
      env: {
        CI: 'true',
        NX_VERBOSE_LOGGING: isCI ? 'true' : 'false',
        ...process.env,
      },
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
    packageManager,
    extraArgs,
    useDetectedPm = false,
  }: {
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
    extraArgs?: string;
    useDetectedPm?: boolean;
  }
) {
  projName = name;

  const pm = getPackageManagerCommand({ packageManager });

  let command = `${
    pm.runUninstalledPackage
  } create-nx-plugin@${getPublishedVersion()} ${name} --nxCloud=skip`;

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
  } ${pkgsWithVersions}`;

  try {
    const install = execSync(command, {
      cwd,
      stdio: isVerbose() ? 'inherit' : 'ignore',
      env: process.env,
      encoding: 'utf-8',
    });

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
        '@nx/devkit': nxVersion,
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
      } else if (packageManager === 'bun') {
        json.overrides = {
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

    if (packageManager === 'pnpm') {
      // pnpm doesn't use the normal package.json packages field so lerna needs to be told that pnpm is the client.
      updateJson('lerna.json', (json) => {
        json.npmClient = 'pnpm';
        return json;
      });
    }

    execSync(pm.install, {
      cwd: tmpProjPath(),
      stdio: isVerbose() ? 'inherit' : 'pipe',
      env: { CI: 'true', ...process.env },
      encoding: 'utf-8',
    });

    // Format files to ensure no changes are made during lerna repair
    execSync(`${pm.runUninstalledPackage} prettier . --write`, {
      cwd: tmpProjPath(),
      stdio: 'ignore',
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
    try {
      if (!skipReset) {
        runCLI('reset', opts);
      }
    } catch {} // ignore crashed daemon
    try {
      removeSync(tmpProjPath());
    } catch {}
  }
  resetWorkspaceContext();
}
