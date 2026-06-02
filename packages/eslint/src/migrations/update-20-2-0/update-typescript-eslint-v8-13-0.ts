import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getDeclaredPackageVersion } from '@nx/devkit/internal';
import { gte, lt } from 'semver';

export default async function (tree: Tree): Promise<GeneratorCallback> {
  const devDependencies: Record<string, string> = {};

  // `@typescript-eslint/parser >=8.0.0` is enforced at the `requires` gate
  // in `migrations.json`. The per-package `gte('8.0.0') && lt('8.13.0')`
  // check below catches the lockstep-broken case where one of the four
  // typescript-eslint packages is at a different major than the parser.
  const checkPackageAndMigrate = (pkgName: string) => {
    const pkgVersion = getDeclaredPackageVersion(tree, pkgName);
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
