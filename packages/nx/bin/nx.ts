#!/usr/bin/env node
import {
  findWorkspaceRoot,
  WorkspaceTypeAndRoot,
} from '../src/utils/find-workspace-root';
import * as chalk from 'chalk';
import { loadRootEnvFiles } from '../src/utils/dotenv';
import { initLocal } from './init-local';
import { output } from '../src/utils/output';
import {
  getNxInstallationPath,
  getNxRequirePaths,
} from '../src/utils/installation-directory';
import { major } from 'semver';
import { stripIndents } from '../src/utils/strip-indents';
import { readModulePackageJson } from '../src/utils/package-json';
import { execSync } from 'child_process';
import { join } from 'path';
import { assertSupportedPlatform } from '../src/native/assert-supported-platform';
import { performance } from 'perf_hooks';
import { setupWorkspaceContext } from '../src/utils/workspace-context';
import { daemonClient } from '../src/daemon/client/client';

function main() {
  if (
    process.argv[2] !== 'report' &&
    process.argv[2] !== '--version' &&
    process.argv[2] !== '--help' &&
    process.argv[2] !== 'reset'
  ) {
    assertSupportedPlatform();
  }

  require('nx/src/utils/perf-logging');

  const workspace = findWorkspaceRoot(process.cwd());

  performance.mark('loading dotenv files:start');
  if (workspace) {
    loadRootEnvFiles(workspace.dir);
  }
  performance.mark('loading dotenv files:end');
  performance.measure(
    'loading dotenv files',
    'loading dotenv files:start',
    'loading dotenv files:end'
  );

  // new is a special case because there is no local workspace to load
  if (
    process.argv[2] === 'new' ||
    process.argv[2] === '_migrate' ||
    process.argv[2] === 'init' ||
    (process.argv[2] === 'graph' && !workspace)
  ) {
    process.env.NX_DAEMON = 'false';
    require('nx/src/command-line/nx-commands').commandsObject.argv;
  } else {
    if (!daemonClient.enabled() && workspace !== null) {
      setupWorkspaceContext(workspace.dir);
    }

    // polyfill rxjs observable to avoid issues with multiple version of Observable installed in node_modules
    // https://twitter.com/BenLesh/status/1192478226385428483?s=20
    if (!(Symbol as any).observable)
      (Symbol as any).observable = Symbol('observable polyfill');

    // Make sure that a local copy of Nx exists in workspace
    let localNx: string;
    try {
      localNx = workspace && resolveNx(workspace);
    } catch {
      localNx = null;
    }

    const isLocalInstall = localNx === resolveNx(null);
    const { LOCAL_NX_VERSION, GLOBAL_NX_VERSION } = determineNxVersions(
      localNx,
      workspace,
      isLocalInstall
    );

    if (process.argv[2] === '--version') {
      handleNxVersionCommand(LOCAL_NX_VERSION, GLOBAL_NX_VERSION);
    }

    if (!workspace) {
      handleNoWorkspace(GLOBAL_NX_VERSION);
    }

    if (!localNx) {
      handleMissingLocalInstallation();
    }

    // this file is already in the local workspace
    if (isLocalInstall) {
      initLocal(workspace);
    } else {
      // Nx is being run from globally installed CLI - hand off to the local
      warnIfUsingOutdatedGlobalInstall(GLOBAL_NX_VERSION, LOCAL_NX_VERSION);
      if (localNx.includes('.nx')) {
        const nxWrapperPath = localNx.replace(/\.nx.*/, '.nx/') + 'nxw.js';
        require(nxWrapperPath);
      } else {
        require(localNx);
      }
    }
  }
}

function handleNoWorkspace(globalNxVersion?: string) {
  output.log({
    title: `The current directory isn't part of an Nx workspace.`,
    bodyLines: [
      `To create a workspace run:`,
      chalk.bold.white(`npx create-nx-workspace@latest <workspace name>`),
      '',
      `To add Nx to an existing workspace with a workspace-specific nx.json, run:`,
      chalk.bold.white(`npx nx@latest init`),
    ],
  });

  output.note({
    title: `For more information please visit https://nx.dev/`,
  });

  warnIfUsingOutdatedGlobalInstall(globalNxVersion);

  process.exit(1);
}

function handleNxVersionCommand(
  LOCAL_NX_VERSION: string,
  GLOBAL_NX_VERSION: string
) {
  console.log(stripIndents`Nx Version:
      - Local: ${LOCAL_NX_VERSION ? 'v' + LOCAL_NX_VERSION : 'Not found'}
      - Global: ${GLOBAL_NX_VERSION ? 'v' + GLOBAL_NX_VERSION : 'Not found'}`);
  process.exit(0);
}

function determineNxVersions(
  localNx: string,
  workspace: WorkspaceTypeAndRoot,
  isLocalInstall: boolean
) {
  const LOCAL_NX_VERSION: string | null = localNx
    ? getLocalNxVersion(workspace)
    : null;
  const GLOBAL_NX_VERSION: string | null = isLocalInstall
    ? null
    : require('../package.json').version;

  globalThis.GLOBAL_NX_VERSION ??= GLOBAL_NX_VERSION;
  return { LOCAL_NX_VERSION, GLOBAL_NX_VERSION };
}

function resolveNx(workspace: WorkspaceTypeAndRoot | null) {
  // root relative to location of the nx bin
  const globalsRoot = join(__dirname, '../../../');

  // prefer Nx installed in .nx/installation
  try {
    return require.resolve('nx/bin/nx.js', {
      paths: [getNxInstallationPath(workspace ? workspace.dir : globalsRoot)],
    });
  } catch {}

  // check for root install
  return require.resolve('nx/bin/nx.js', {
    paths: [workspace ? workspace.dir : globalsRoot],
  });
}

function handleMissingLocalInstallation() {
  output.error({
    title: `Could not find Nx modules in this workspace.`,
    bodyLines: [`Have you run ${chalk.bold.white(`npm/yarn install`)}?`],
  });
  process.exit(1);
}

/**
 * Assumes currently running Nx is global install.
 * Warns if out of date by 1 major version or more.
 */
function warnIfUsingOutdatedGlobalInstall(
  globalNxVersion: string,
  localNxVersion?: string
) {
  // Never display this warning if Nx is already running via Nx
  if (process.env.NX_CLI_SET) {
    return;
  }

  const isOutdatedGlobalInstall = checkOutdatedGlobalInstallation(
    globalNxVersion,
    localNxVersion
  );

  // Using a global Nx Install
  if (isOutdatedGlobalInstall) {
    const bodyLines = localNxVersion
      ? [
          `Your repository uses a higher version of Nx (${localNxVersion}) than your global CLI version (${globalNxVersion})`,
        ]
      : [];

    bodyLines.push(
      'For more information, see https://nx.dev/more-concepts/global-nx'
    );
    output.warn({
      title: `It's time to update Nx 🎉`,
      bodyLines,
    });
  }
}

function checkOutdatedGlobalInstallation(
  globalNxVersion?: string,
  localNxVersion?: string
) {
  // We aren't running a global install, so we can't know if its outdated.
  if (!globalNxVersion) {
    return false;
  }
  if (localNxVersion) {
    // If the global Nx install is at least a major version behind the local install, warn.
    return major(globalNxVersion) < major(localNxVersion);
  }
  // No local installation was detected. This can happen if the user is running a global install
  // that contains an older version of Nx, which is unable to detect the local installation. The most
  // recent case where this would have happened would be when we stopped generating workspace.json by default,
  // as older global installations used it to determine the workspace root. This only be hit in rare cases,
  // but can provide valuable insights for troubleshooting.
  const latestVersionOfNx = getLatestVersionOfNx();
  if (latestVersionOfNx && major(globalNxVersion) < major(latestVersionOfNx)) {
    return true;
  }
}

function getLocalNxVersion(workspace: WorkspaceTypeAndRoot): string | null {
  try {
    const { packageJson } = readModulePackageJson(
      'nx',
      getNxRequirePaths(workspace.dir)
    );
    return packageJson.version;
  } catch {}
}

function _getLatestVersionOfNx(): string {
  try {
    return execSync('npm view nx@latest version', {
      windowsHide: true,
    })
      .toString()
      .trim();
  } catch {
    try {
      return execSync('pnpm view nx@latest version', {
        windowsHide: true,
      })
        .toString()
        .trim();
    } catch {
      return null;
    }
  }
}

const getLatestVersionOfNx = ((fn: () => string) => {
  let cache: string = null;
  return () => cache || (cache = fn());
})(_getLatestVersionOfNx);

main();
