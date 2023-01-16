import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { backwardCompatibleVersions } from '../../../../utils/backward-compatible-versions';

export function addAngularEsLintDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@angular-eslint/eslint-plugin':
        backwardCompatibleVersions.angularV14.angularEslintVersion,
      '@angular-eslint/eslint-plugin-template':
        backwardCompatibleVersions.angularV14.angularEslintVersion,
      '@angular-eslint/template-parser':
        backwardCompatibleVersions.angularV14.angularEslintVersion,
    }
  );
}
