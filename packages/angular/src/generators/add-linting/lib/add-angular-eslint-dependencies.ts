import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { angularEslintVersion } from '../../../utils/versions';

export function addAngularEsLintDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@angular-eslint/eslint-plugin': angularEslintVersion,
      '@angular-eslint/eslint-plugin-template': angularEslintVersion,
      '@angular-eslint/template-parser': angularEslintVersion,
    }
  );
}
