import { join } from 'path';
import { platform } from 'os';
import * as fs from 'fs';
import {
  createDirectory,
  readJsonFile,
} from '@nrwl/workspace/src/utilities/fileutils';
import chalk = require('chalk');

const requiredPackages = [
  'react-native',
  'jsc-android',
  '@react-native-community/cli-platform-ios',
  '@react-native-community/cli-platform-android',
  'hermes-engine',
  '@nrwl/react-native',
  '@babel/runtime',
];

/**
 * This function symlink workspace node_modules folder with app project's node_mdules folder.
 * For yarn and npm, it will symlink the entire node_modules folder.
 * If app project's node_modules already exist, it will remove it first then symlink it.
 * For pnpm, it will go through the package.json' dependencies and devDependencies, and also the required packages listed above.
 * @param workspaceRoot path of the workspace root
 * @param projectRoot path of app project root
 */
export function ensureNodeModulesSymlink(
  workspaceRoot: string,
  projectRoot: string
): void {
  const worksapceNodeModulesPath = join(workspaceRoot, 'node_modules');
  if (!fs.existsSync(worksapceNodeModulesPath)) {
    throw new Error(`Cannot find ${worksapceNodeModulesPath}`);
  }

  const appNodeModulesPath = join(workspaceRoot, projectRoot, 'node_modules');
  // `mklink /D` requires admin privilege in Windows so we need to use junction
  const symlinkType = platform() === 'win32' ? 'junction' : 'dir';

  if (fs.existsSync(appNodeModulesPath)) {
    fs.rmdirSync(appNodeModulesPath, { recursive: true });
  }
  fs.symlinkSync(worksapceNodeModulesPath, appNodeModulesPath, symlinkType);

  if (isPnpm(workspaceRoot)) {
    symlinkPnpm(workspaceRoot, appNodeModulesPath, symlinkType);
  }
}

function isPnpm(workspaceRoot: string): boolean {
  const pnpmDir = join(workspaceRoot, 'node_modules/.pnpm');
  return fs.existsSync(pnpmDir);
}

function symlinkPnpm(
  workspaceRoot: string,
  appNodeModulesPath: string,
  symlinkType: 'junction' | 'dir'
) {
  const worksapcePackageJsonPath = join(workspaceRoot, 'package.json');
  const workspacePackageJson = readJsonFile(worksapcePackageJsonPath);
  const workspacePackages = Object.keys({
    ...workspacePackageJson.dependencies,
    ...workspacePackageJson.devDependencies,
  });

  const packagesToSymlink = new Set([
    ...workspacePackages,
    ...requiredPackages,
  ]);

  createDirectory(appNodeModulesPath);

  packagesToSymlink.forEach((p) => {
    const dir = join(appNodeModulesPath, p);
    if (!fs.existsSync(dir)) {
      if (isScopedPackage(p))
        createDirectory(join(appNodeModulesPath, getScopedData(p).scope));
      fs.symlinkSync(locateNpmPackage(workspaceRoot, p), dir, symlinkType);
    }
    if (!fs.existsSync(join(dir, 'package.json'))) {
      throw new Error(
        `Invalid symlink ${chalk.bold(dir)}. Remove ${chalk.bold(
          appNodeModulesPath
        )} and try again.`
      );
    }
  });
}

function locateNpmPackage(workspaceRoot: string, packageName: string): string {
  const pnpmDir = join(workspaceRoot, 'node_modules/.pnpm');

  let candidates: string[];
  if (isScopedPackage(packageName)) {
    const { scope, name } = getScopedData(packageName);
    candidates = fs
      .readdirSync(pnpmDir)
      .filter(
        (f) =>
          f.startsWith(`${scope}+${name}`) &&
          fs.lstatSync(join(pnpmDir, f)).isDirectory()
      );
  } else {
    candidates = fs
      .readdirSync(pnpmDir)
      .filter(
        (f) =>
          f.startsWith(packageName) &&
          fs.lstatSync(join(pnpmDir, f)).isDirectory()
      );
  }

  if (candidates.length === 0) {
    throw new Error(`Could not locate pnpm directory for ${packageName}`);
  } else if (candidates.length === 1) {
    return join(pnpmDir, candidates[0], 'node_modules', packageName);
  } else {
    const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    const version = deps[packageName];
    const found = candidates.find((c) => c.includes(version));
    if (found) {
      return join(pnpmDir, found, 'node_modules', packageName);
    } else {
      throw new Error(
        `Cannot find ${packageName}@${version}. Install it with 'pnpm install --save ${packageName}@${version}'.`
      );
    }
  }
}

function isScopedPackage(p) {
  return p.startsWith('@');
}

function getScopedData(p) {
  const [scope, name] = p.split('/');
  return { scope, name };
}
