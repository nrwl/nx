import { readJson, readJsonFile, type Tree } from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { readModulePackageJson } from 'nx/src/devkit-internals';

export function getInstalledPackageVersion(
  pkgName: string,
  tree?: Tree
): string | null {
  try {
    const packageJson = readModulePackageJson(pkgName).packageJson;
    return packageJson.version;
  } catch {}

  // the package is not installed on disk, it could be in the package.json
  // but waiting to be installed
  const rootPackageJson = tree
    ? readJson(tree, 'package.json')
    : readJsonFile('package.json');
  const pkgVersionInRootPackageJson =
    rootPackageJson.devDependencies?.[pkgName] ??
    rootPackageJson.dependencies?.[pkgName];

  if (!pkgVersionInRootPackageJson) {
    // the package is not installed
    return null;
  }

  try {
    // try to parse and return the version
    return checkAndCleanWithSemver(pkgName, pkgVersionInRootPackageJson);
  } catch {}

  // we could not resolve the version
  return null;
}

export function getInstalledEslintVersion(tree?: Tree): string | null {
  return getInstalledPackageVersion('eslint', tree);
}
