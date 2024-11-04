import { readJson, readJsonFile, type Tree } from '@nx/devkit';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { readModulePackageJson } from 'nx/src/devkit-internals';

export function getInstalledEslintVersion(tree?: Tree): string | null {
  try {
    const eslintPackageJson = readModulePackageJson('eslint').packageJson;
    return eslintPackageJson.version;
  } catch {}

  // eslint is not installed on disk, it could be in the package.json
  // but waiting to be installed
  const rootPackageJson = tree
    ? readJson(tree, 'package.json')
    : readJsonFile('package.json');
  const eslintVersionInRootPackageJson =
    rootPackageJson.devDependencies?.['eslint'] ??
    rootPackageJson.dependencies?.['eslint'];

  if (!eslintVersionInRootPackageJson) {
    // eslint is not installed
    return null;
  }

  try {
    // try to parse and return the version
    return checkAndCleanWithSemver('eslint', eslintVersionInRootPackageJson);
  } catch {}

  // we could not resolve the version
  return null;
}
