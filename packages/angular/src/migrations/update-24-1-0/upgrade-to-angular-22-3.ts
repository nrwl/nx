import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  type Tree,
} from '@nx/devkit';
import { getDeclaredPackageVersion } from '@nx/devkit/internal';
import { satisfies } from 'semver';

// Keep these versions pinned; versions.ts advances to later Angular versions.
const ANGULAR_22_3_VERSIONS: Record<string, string> = {
  '@angular/core': '~22.3.0',
  '@angular/animations': '~22.3.0',
  '@angular/common': '~22.3.0',
  '@angular/compiler': '~22.3.0',
  '@angular/compiler-cli': '~22.3.0',
  '@angular/elements': '~22.3.0',
  '@angular/forms': '~22.3.0',
  '@angular/language-service': '~22.3.0',
  '@angular/localize': '~22.3.0',
  '@angular/platform-browser': '~22.3.0',
  '@angular/platform-browser-dynamic': '~22.3.0',
  '@angular/platform-server': '~22.3.0',
  '@angular/router': '~22.3.0',
  '@angular/service-worker': '~22.3.0',
  '@angular/upgrade': '~22.3.0',
  '@angular/cli': '~22.3.0',
  '@angular/build': '~22.3.0',
  '@angular/pwa': '~22.3.0',
  '@angular/ssr': '~22.3.0',
  '@angular-devkit/build-angular': '~22.3.0',
  '@angular-devkit/core': '~22.3.0',
  '@angular-devkit/schematics': '~22.3.0',
  '@angular-devkit/architect': '~0.2203.0',
  '@angular-devkit/build-webpack': '~0.2203.0',
  '@schematics/angular': '~22.3.0',
  '@angular/aria': '~22.3.0',
  '@angular/cdk': '~22.3.0',
  '@angular/cdk-experimental': '~22.3.0',
  '@angular/google-maps': '~22.3.0',
  '@angular/material': '~22.3.0',
  '@angular/material-date-fns-adapter': '~22.3.0',
  '@angular/material-experimental': '~22.3.0',
  '@angular/material-luxon-adapter': '~22.3.0',
  '@angular/material-moment-adapter': '~22.3.0',
  'ng-packagr': '~22.3.0',
  'zone.js': '~0.16.2',
};

// The 22.2 upgrade is a migration, so it runs after `nx migrate` picks the
// package updates, and a workspace starting on 22.1 misses the 22.3 ones.
export default async function upgradeToAngular223(tree: Tree) {
  // The 22.2 upgrade keeps 22.1 when a known issue blocks it.
  const angularCoreVersion = getDeclaredPackageVersion(tree, '@angular/core');
  if (!angularCoreVersion || !satisfies(angularCoreVersion, '~22.2.0')) {
    return;
  }

  const declared = readJson(tree, 'package.json');
  addDependenciesToPackageJson(
    tree,
    {},
    Object.fromEntries(
      Object.entries(ANGULAR_22_3_VERSIONS).filter(
        ([name]) =>
          declared.dependencies?.[name] || declared.devDependencies?.[name]
      )
    )
  );

  await formatFiles(tree);
}
