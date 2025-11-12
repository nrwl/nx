import {
  addDependenciesToPackageJson,
  formatFiles,
  getDependencyVersionFromPackageJson,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersionInfo } from '../../generators/utils/version-utils.js';

export const typescriptEslintUtilsVersion = '^7.16.0';

export default async function (tree: Tree) {
  if (getDependencyVersionFromPackageJson(tree, '@typescript-eslint/utils')) {
    return;
  }

  const eslintPluginVersionInfo =
    getInstalledPackageVersionInfo(tree, '@angular-eslint/eslint-plugin') ??
    getInstalledPackageVersionInfo(
      tree,
      '@angular-eslint/eslint-plugin-template'
    );
  if (!eslintPluginVersionInfo || eslintPluginVersionInfo.major < 18) {
    return;
  }

  addDependenciesToPackageJson(
    tree,
    {},
    { '@typescript-eslint/utils': typescriptEslintUtilsVersion }
  );

  await formatFiles(tree);
}
