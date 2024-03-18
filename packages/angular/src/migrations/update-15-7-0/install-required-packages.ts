import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  getPackageManagerCommand,
  readJson,
  writeJsonFile,
} from '@nx/devkit';
import { execSync } from 'child_process';
import { join } from 'path';
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
    pkgJson.devDependencies?.['@angular-devkit/build-angular'] ??
    pkgJson.dependencies?.['@angular-devkit/build-angular'] ??
    angularDevkitVersion;

  const filteredPackages: Record<string, string> = packagesToInstall
    .filter(
      (pkg) => !pkgJson.devDependencies?.[pkg] && !pkgJson.dependencies?.[pkg]
    )
    .reduce((allPkgs, pkg) => ({ ...allPkgs, [pkg]: angularCliVersion }), {});
  // even though we are going to install the packages directly, we still want
  // to add them to the tree so the migrate command knows changes were made
  addDependenciesToPackageJson(tree, {}, { ...filteredPackages });

  // we need to install them immediately so the packages are available for
  // other migrations that might be using them
  pkgJson.devDependencies ??= {};
  Object.entries(filteredPackages).forEach(([pkg, version]) => {
    pkgJson.devDependencies[pkg] = version;
  });
  writeJsonFile(join(tree.root, 'package.json'), pkgJson);
  const pmc = getPackageManagerCommand();
  execSync(pmc.install, { stdio: [0, 1, 2] });
}
