import {
  addDependenciesToPackageJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import {
  eslintConfigPrettierVersion,
  nxVersion,
  typescriptESLintVersion,
} from '../../utils/versions';
import { getGlobalEsLintConfiguration } from '../init/global-eslint-config';
import { findEslintFile } from '../utils/eslint-file';

export type SetupRootEsLintOptions = {
  unitTestRunner?: string;
  skipPackageJson?: boolean;
  rootProject?: boolean;
};

export function setupRootEsLint(
  tree: Tree,
  options: SetupRootEsLintOptions
): GeneratorCallback {
  const rootEslintFile = findEslintFile(tree);
  if (rootEslintFile) {
    return () => {};
  }

  writeJson(
    tree,
    '.eslintrc.json',
    getGlobalEsLintConfiguration(options.unitTestRunner, options.rootProject)
  );

  if (tree.exists('.eslintignore')) {
    let content = tree.read('.eslintignore', 'utf-8');
    if (!/^node_modules$/gm.test(content)) {
      content = `${content}\nnode_modules\n`;
      tree.write('.eslintignore', content);
    }
  } else {
    tree.write('.eslintignore', 'node_modules\n');
  }

  return !options.skipPackageJson
    ? addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/eslint-plugin': nxVersion,
          '@typescript-eslint/parser': typescriptESLintVersion,
          '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
          'eslint-config-prettier': eslintConfigPrettierVersion,
        }
      )
    : () => {};
}
