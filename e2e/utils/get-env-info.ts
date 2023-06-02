import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync } from 'fs-extra';
import { join } from 'path';
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
    readJsonFile(join(workspaceRoot, `./build/packages/nx/package.json`))
      .version ||
    // fallback to latest if built nx package is missing
    'latest';
  return process.env.PUBLISHED_VERSION as string;
}

export function detectPackageManager(dir: string = ''): PackageManager {
  return existsSync(join(dir, 'yarn.lock'))
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

export function getSelectedPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  return (process.env.SELECTED_PM as 'npm' | 'yarn' | 'pnpm') || 'npm';
}

export function getNpmMajorVersion(): string {
  const [npmMajorVersion] = execSync(`npm -v`).toString().split('.');
  return npmMajorVersion;
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

export function getStrippedEnvironmentVariables() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => {
      if (key.startsWith('NX_E2E_')) {
        return true;
      }

      if (key.startsWith('NX_')) {
        return false;
      }

      return true;
    })
  );
}
