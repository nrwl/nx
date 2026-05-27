import {
  addDependenciesToPackageJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { useFlatConfig } from '../../utils/flat-config';
import {
  eslintConfigPrettierVersion,
  nxVersion,
  versions,
} from '../../utils/versions';
import {
  getGlobalEsLintConfiguration,
  getGlobalFlatEslintConfiguration,
} from '../init/global-eslint-config';
import { findEslintFile } from '../utils/eslint-file';

export type SetupRootEsLintOptions = {
  unitTestRunner?: string;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  eslintConfigFormat?: 'mjs' | 'cjs';
};

export function setupRootEsLint(
  tree: Tree,
  options: SetupRootEsLintOptions
): GeneratorCallback {
  const rootEslintFile = findEslintFile(tree);
  if (rootEslintFile) {
    return () => {};
  }
  options.eslintConfigFormat ??= 'mjs';

  if (!useFlatConfig(tree)) {
    return setUpLegacyRootEslintRc(tree, options);
  }
  return setUpRootFlatConfig(tree, options);
}

function setUpLegacyRootEslintRc(tree: Tree, options: SetupRootEsLintOptions) {
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

  if (options.skipPackageJson) {
    return () => {};
  }

  const { typescriptESLintVersion } = versions(tree);
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/eslint-plugin': nxVersion,
      '@typescript-eslint/parser': typescriptESLintVersion,
      '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
      'eslint-config-prettier': eslintConfigPrettierVersion,
    }
  );
}

function setUpRootFlatConfig(tree: Tree, options: SetupRootEsLintOptions) {
  tree.write(
    `eslint.config.${options.eslintConfigFormat}`,
    getGlobalFlatEslintConfiguration(
      options.eslintConfigFormat,
      options.rootProject
    )
  );

  if (options.skipPackageJson) {
    return () => {};
  }

  const { eslintVersion, typescriptESLintVersion } = versions(tree);
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@eslint/js': eslintVersion,
      '@nx/eslint-plugin': nxVersion,
      eslint: eslintVersion,
      'eslint-config-prettier': eslintConfigPrettierVersion,
      'typescript-eslint': typescriptESLintVersion,
    }
  );
}
