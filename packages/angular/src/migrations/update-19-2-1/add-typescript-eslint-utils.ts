import {
  addDependenciesToPackageJson,
  formatFiles,
  type Tree,
} from '@nx/devkit';
import {
  getInstalledPackageVersion,
  getInstalledPackageVersionInfo,
} from '../../generators/utils/version-utils';

export const typescriptEslintUtilsVersion = '^8.0.0-alpha.28';

export default async function (tree: Tree) {
  if (getInstalledPackageVersion(tree, '@typescript-eslint/utils')) {
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
