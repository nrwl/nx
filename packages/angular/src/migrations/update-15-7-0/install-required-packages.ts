import type { Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson, readJson } from '@nrwl/devkit';
import { getInstalledAngularMajorVersion } from '../../generators/utils/version-utils';
import { getPkgVersionForAngularMajorVersion } from '../../utils/version-utils';

export default async function (tree: Tree) {
  const packagesToInstall = [
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@schematics/angular',
  ];
  const pkgJson = readJson(tree, 'package.json');

  const angularMajorVersion = getInstalledAngularMajorVersion(tree);
  const angularDevkitVersion = getPkgVersionForAngularMajorVersion(
    'angularDevkitVersion',
    angularMajorVersion
  );

  const angularCliVersion =
    pkgJson.devDependencies?.['@angular/cli'] ??
    pkgJson.dependencies?.['@angular/cli'] ??
    angularDevkitVersion;

  const filteredPackages: Record<string, string> = packagesToInstall
    .filter(
      (pkg) => !pkgJson.devDependencies?.[pkg] && !pkgJson.dependencies?.[pkg]
    )
    .reduce((allPkgs, pkg) => ({ ...allPkgs, [pkg]: angularCliVersion }), {});

  addDependenciesToPackageJson(tree, {}, { ...filteredPackages });
}
