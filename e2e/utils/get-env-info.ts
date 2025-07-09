import { readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'fs-extra';
import { execSync } from 'node:child_process';
import { join } from 'path';
import { gte } from 'semver';
import { dirSync } from 'tmp';
import { load as parseYaml } from 'js-yaml';

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

function getWorkspacePackagePatterns(): string[] {
  try {
    let currentDir = process.cwd();
    let pnpmWorkspaceFile: string | null = null;

    while (currentDir !== '/' && currentDir.length > 1) {
      const possiblePath = join(currentDir, 'pnpm-workspace.yaml');
      if (existsSync(possiblePath)) {
        pnpmWorkspaceFile = possiblePath;
        break;
      }
      currentDir = join(currentDir, '..');
    }

    if (!pnpmWorkspaceFile) {
      return [];
    }

    const yamlContent = readFileSync(pnpmWorkspaceFile, 'utf-8');
    const workspaceConfig = parseYaml(yamlContent) as { packages?: string[] };

    return workspaceConfig.packages || [];
  } catch (e) {
    return [];
  }
}

function pathMatchesWorkspacePattern(
  path: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    const regexPattern = pattern.replace(/\*/g, '[^/]+').replace(/\//g, '\\/');

    const regex = new RegExp(regexPattern);

    if (regex.test(path) || path.includes(`/${pattern.replace('/*', '/')}`)) {
      return true;
    }
  }
  return false;
}

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
  const playwrightInstallArgs =
    process.env.PLAYWRIGHT_INSTALL_ARGS || '--with-deps';
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
}

export function getStrippedEnvironmentVariables() {
  const workspacePatterns = getWorkspacePackagePatterns();

  return Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => {
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

      if (key === 'NODE_PATH') {
        return false;
      }

      return true;
    })
  );
}
