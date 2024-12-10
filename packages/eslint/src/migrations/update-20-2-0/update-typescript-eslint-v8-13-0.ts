import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { gte, lt } from 'semver';
import { getInstalledPackageVersion } from '../../utils/version-utils';

export default async function (tree: Tree): Promise<GeneratorCallback> {
  const devDependencies: Record<string, string> = {};

  const checkPackageAndMigrate = (pkgName: string) => {
    const pkgVersion = getInstalledPackageVersion(pkgName, tree);
    if (!!pkgVersion && gte(pkgVersion, '8.0.0') && lt(pkgVersion, '8.13.0')) {
      devDependencies[pkgName] = '^8.13.0';
    }
  };

  checkPackageAndMigrate('typescript-eslint');
  checkPackageAndMigrate('@typescript-eslint/eslint-plugin');
  checkPackageAndMigrate('@typescript-eslint/parser');
  checkPackageAndMigrate('@typescript-eslint/utils');

  if (Object.keys(devDependencies).length > 0) {
    return addDependenciesToPackageJson(tree, {}, devDependencies);
  }

  return () => {};
}
