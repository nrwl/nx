import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { angularEslintVersion } from '../../../utils/versions';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { backwardCompatibleVersions } from '../../../utils/backward-compatible-versions';

export function addAngularEsLintDependencies(tree: Tree): GeneratorCallback {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);
  const angularEslintVersionToInstall =
    installedAngularVersionInfo.major === 14
      ? backwardCompatibleVersions.angularV14.angularEslintVersion
      : angularEslintVersion;
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@angular-eslint/eslint-plugin': angularEslintVersionToInstall,
      '@angular-eslint/eslint-plugin-template': angularEslintVersionToInstall,
      '@angular-eslint/template-parser': angularEslintVersionToInstall,
    }
  );
}
