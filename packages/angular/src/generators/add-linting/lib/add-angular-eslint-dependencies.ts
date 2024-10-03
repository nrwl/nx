import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { versions } from '../../utils/version-utils';
import { isBuildableLibraryProject } from './buildable-project';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';
import {
  eslint9__eslintVersion,
  eslint9__typescriptESLintVersion,
} from '@nx/eslint/src/utils/versions';
import { getInstalledEslintVersion } from '@nx/eslint/src/utils/version-utils';
import { gte } from 'semver';

export function addAngularEsLintDependencies(
  tree: Tree,
  projectName: string
): GeneratorCallback {
  const compatVersions = versions(tree);
  const angularEslintVersionToInstall = compatVersions.angularEslintVersion;
  const devDependencies = useFlatConfig(tree)
    ? {
        'angular-eslint': angularEslintVersionToInstall,
      }
    : {
        '@angular-eslint/eslint-plugin': angularEslintVersionToInstall,
        '@angular-eslint/eslint-plugin-template': angularEslintVersionToInstall,
        '@angular-eslint/template-parser': angularEslintVersionToInstall,
      };

  if ('typescriptEslintVersion' in compatVersions) {
    const installedEslintVersion = getInstalledEslintVersion(tree);
    const usingEslintV9 = gte(
      installedEslintVersion ?? eslint9__eslintVersion,
      '9.0.0'
    );
    devDependencies['@typescript-eslint/utils'] = usingEslintV9
      ? eslint9__typescriptESLintVersion
      : compatVersions.typescriptEslintVersion;
  }

  if (isBuildableLibraryProject(tree, projectName)) {
    const jsoncEslintParserVersionToInstall =
      versions(tree).jsoncEslintParserVersion;
    devDependencies['jsonc-eslint-parser'] = jsoncEslintParserVersionToInstall;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}
