import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs-extra';
import { execSync } from 'node:child_process';
import { join } from 'path';
import { gte } from 'semver';
import { dirSync } from 'tmp';

import * as isCI from 'is-ci';
import { PackageManager } from 'nx/src/utils/package-manager';
import { tmpProjPath } from './create-project-utils';
import { e2eConsoleLogger } from './log-utils';

export const isWindows = require('is-windows');

export function getPublishedVersion(): string {
  process.env.PUBLISHED_VERSION =
    process.env.PUBLISHED_VERSION ||
    // read version of built nx package
    readJsonFile(join(workspaceRoot, `./dist/packages/nx/package.json`))
      .version ||
    // fallback to latest if built nx package is missing
    'latest';
  return process.env.PUBLISHED_VERSION as string;
}

export function detectPackageManager(dir: string = ''): PackageManager {
  return existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))
    ? 'bun'
    : existsSync(join(dir, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(dir, 'pnpm-lock.yaml')) ||
      existsSync(join(dir, 'pnpm-workspace.yaml'))
    ? 'pnpm'
    : 'npm';
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

export const e2eRoot = isCI
  ? dirSync({ prefix: 'nx-e2e-' }).name
  : '/tmp/nx-e2e';

export function isVerbose() {
  return (
    process.env.NX_VERBOSE_LOGGING === 'true' ||
    process.argv.includes('--verbose')
  );
}

export function isVerboseE2ERun() {
  return process.env.NX_E2E_VERBOSE_LOGGING === 'true' || isVerbose();
}

export const e2eCwd = `${e2eRoot}/nx`;

export function getSelectedPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  return (process.env.SELECTED_PM as 'npm' | 'yarn' | 'pnpm' | 'bun') || 'npm';
}

export function getNpmMajorVersion(): string | undefined {
  try {
    const [npmMajorVersion] = execSync(`npm -v`).toString().split('.');
    return npmMajorVersion;
  } catch {
    return undefined;
  }
}

export function getYarnMajorVersion(path: string): string | undefined {
  try {
    // this fails if path is not yet created
    const [yarnMajorVersion] = execSync(`yarn -v`, {
      cwd: path,
      encoding: 'utf-8',
    }).split('.');
    return yarnMajorVersion;
  } catch {
    try {
      const [yarnMajorVersion] = execSync(`yarn -v`, {
        encoding: 'utf-8',
      }).split('.');
      return yarnMajorVersion;
    } catch {
      return undefined;
    }
  }
}

export function getPnpmVersion(): string | undefined {
  try {
    const pnpmVersion = execSync(`pnpm -v`, {
      encoding: 'utf-8',
    }).trim();
    return pnpmVersion;
  } catch {
    return undefined;
  }
}

export function getLatestLernaVersion(): string {
  const lernaVersion = execSync(`npm view lerna version`, {
    encoding: 'utf-8',
  }).trim();
  return lernaVersion;
}

export const packageManagerLockFile = {
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
  pnpm: 'pnpm-lock.yaml',
  bun: (() => {
    try {
      // In version 1.2.0, bun switched to a text based lockfile format by default
      return gte(execSync('bun --version').toString().trim(), '1.2.0')
        ? 'bun.lock'
        : 'bun.lockb';
    } catch {
      return 'bun.lockb';
    }
  })(),
};

export function ensureCypressInstallation() {
  let cypressVerified = true;
  try {
    const r = execSync('npx cypress verify', {
      stdio: isVerbose() ? 'inherit' : 'pipe',
      encoding: 'utf-8',
      cwd: tmpProjPath(),
    });
    if (r.indexOf('Verified Cypress!') === -1) {
      cypressVerified = false;
    }
  } catch {
    cypressVerified = false;
  } finally {
    if (!cypressVerified) {
      e2eConsoleLogger('Cypress was not verified. Installing Cypress now.');
      execSync('npx cypress install', {
        stdio: isVerbose() ? 'inherit' : 'pipe',
        encoding: 'utf-8',
        cwd: tmpProjPath(),
      });
    }
  }
}

export function ensurePlaywrightBrowsersInstallation() {
  // Lightweight check: try to get Playwright browser path
  try {
    const browserPath = execSync('npx playwright install --dry-run', {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: tmpProjPath(),
    });

    // If browsers are up to date, skip installation
    if (browserPath.includes('browser binaries are up to date')) {
      e2eConsoleLogger('Playwright browsers already installed locally');
      return;
    }
  } catch {
    // If dry-run fails, browsers likely need installation
  }

  // Only install browsers for local development
  const playwrightInstallArgs =
    process.env.PLAYWRIGHT_INSTALL_ARGS || '--with-deps';

  e2eConsoleLogger('Installing Playwright browsers for local development...');

  try {
    execSync(`npx playwright install ${playwrightInstallArgs}`, {
      stdio: isVerbose() ? 'inherit' : 'pipe',
      encoding: 'utf-8',
      cwd: tmpProjPath(),
    });

    e2eConsoleLogger(
      `Playwright browsers ${execSync('npx playwright --version')
        .toString()
        .trim()} installed.`
    );
  } catch (error) {
    e2eConsoleLogger('Failed to install Playwright browsers:', error);
    throw error;
  }
}

export function getStrippedEnvironmentVariables() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      if (key.startsWith('NX_E2E_')) {
        return true;
      }

      const allowedKeys = [
        'NX_ADD_PLUGINS',
        'NX_ISOLATE_PLUGINS',
        'NX_VERBOSE_LOGGING',
        'NX_NATIVE_LOGGING',
      ];

      if (key.startsWith('NX_') && !allowedKeys.includes(key)) {
        return false;
      }

      if (key === 'JEST_WORKER_ID') {
        return false;
      }

      // Remove NODE_PATH to prevent module resolution conflicts with original workspace.
      // NODE_PATH is inherited from Jest (which runs from the original workspace) and contains
      // pnpm paths that cause require.resolve() to find workspace packages instead of e2e test versions.
      if (key === 'NODE_PATH') {
        return false;
      }

      return true;
    })
  );
}
