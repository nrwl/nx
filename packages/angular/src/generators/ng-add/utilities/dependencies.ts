import { addDependenciesToPackageJson, readJson, Tree } from '@nx/devkit';
import { getPkgVersionForAngularMajorVersion } from '../../../utils/version-utils';
import { getInstalledAngularMajorVersion } from '../../utils/version-utils';

export function ensureAngularDevKitPeerDependenciesAreInstalled(
  tree: Tree
): void {
  const packagesToInstall = [
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@schematics/angular',
  ];

  const { devDependencies, dependencies } = readJson(tree, 'package.json');
  let angularCliVersion =
    devDependencies?.['@angular/cli'] ?? dependencies?.['@angular/cli'];

  if (!angularCliVersion) {
    const angularMajorVersion = getInstalledAngularMajorVersion(tree);
    const angularDevkitVersion = getPkgVersionForAngularMajorVersion(
      'angularDevkitVersion',
      angularMajorVersion
    );
    angularCliVersion = angularDevkitVersion;
  }

  const filteredPackages = packagesToInstall
    .filter((pkg) => !devDependencies?.[pkg] && !dependencies?.[pkg])
    .reduce((allPkgs, pkg) => {
      allPkgs[pkg] = angularCliVersion;
      return allPkgs;
    }, {} as Record<string, string>);

  addDependenciesToPackageJson(tree, {}, filteredPackages);
}
