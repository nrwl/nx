import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import {
  addInstallTask,
  checkAndCleanWithSemver,
  formatFiles,
  updateJsonInTree,
} from '@nrwl/workspace';

import { gte } from 'semver';
let needsInstall = false;

const maybeUpdateVersion = updateJsonInTree('package.json', (json) => {
  json.dependencies = json.dependencies || {};
  json.devDependencies = json.devDependencies || {};

  const storybookPackages = [
    '@storybook/angular',
    '@storybook/react',
    '@storybook/addon-knobs',
  ];
  storybookPackages.forEach((storybookPackageName) => {
    if (json.dependencies[storybookPackageName]) {
      const version = checkAndCleanWithSemver(
        storybookPackageName,
        json.dependencies[storybookPackageName]
      );
      if (gte(version, '6.0.0')) {
        json.dependencies[storybookPackageName] = '^6.1.11';
        needsInstall = true;
      }
    }
    if (json.devDependencies[storybookPackageName]) {
      const version = checkAndCleanWithSemver(
        storybookPackageName,
        json.devDependencies[storybookPackageName]
      );
      if (gte(version, '6.0.0')) {
        json.devDependencies[storybookPackageName] = '^6.1.11';
        needsInstall = true;
      }
    }
  });

  return json;
});

export default function (tree: Tree, context: SchematicContext) {
  return chain([
    maybeUpdateVersion,
    formatFiles(),
    addInstallTask({ skipInstall: !needsInstall }),
  ]);
}
