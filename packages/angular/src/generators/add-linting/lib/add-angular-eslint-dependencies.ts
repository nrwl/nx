import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { versions } from '../../utils/version-utils';
import { isBuildableLibraryProject } from './buildable-project';

export function addAngularEsLintDependencies(
  tree: Tree,
  projectName: string
): GeneratorCallback {
  const compatVersions = versions(tree);
  const angularEslintVersionToInstall = compatVersions.angularEslintVersion;
  const devDependencies = {
    '@angular-eslint/eslint-plugin': angularEslintVersionToInstall,
    '@angular-eslint/eslint-plugin-template': angularEslintVersionToInstall,
    '@angular-eslint/template-parser': angularEslintVersionToInstall,
  };

  if ('typescriptEslintVersion' in compatVersions) {
    devDependencies['@typescript-eslint/utils'] =
      compatVersions.typescriptEslintVersion;
  }

  if (isBuildableLibraryProject(tree, projectName)) {
    const jsoncEslintParserVersionToInstall =
      versions(tree).jsoncEslintParserVersion;
    devDependencies['jsonc-eslint-parser'] = jsoncEslintParserVersionToInstall;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}
