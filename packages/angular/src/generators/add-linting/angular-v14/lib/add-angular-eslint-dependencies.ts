import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { versions } from '../../../../utils/versions';

export function addAngularEsLintDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@angular-eslint/eslint-plugin': versions.angularV14.angularEslintVersion,
      '@angular-eslint/eslint-plugin-template':
        versions.angularV14.angularEslintVersion,
      '@angular-eslint/template-parser':
        versions.angularV14.angularEslintVersion,
    }
  );
}
