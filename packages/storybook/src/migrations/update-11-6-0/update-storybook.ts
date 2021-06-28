import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';

import { gte, lt } from 'semver';
import {
  formatFiles,
  installPackagesTask,
  Tree,
  updateJson,
} from '@nrwl/devkit';

let needsInstall = false;

function maybeUpdateVersion(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
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
        if (gte(version, '6.0.0') && lt(version, '6.2.9')) {
          json.dependencies[storybookPackageName] = '~6.2.9';
          needsInstall = true;
        }
      }
      if (json.devDependencies[storybookPackageName]) {
        const version = checkAndCleanWithSemver(
          storybookPackageName,
          json.devDependencies[storybookPackageName]
        );
        if (gte(version, '6.0.0') && lt(version, '6.2.9')) {
          json.devDependencies[storybookPackageName] = '~6.2.9';
          needsInstall = true;
        }
      }
    });

    return json;
  });
}

export default async function (tree: Tree) {
  maybeUpdateVersion(tree);
  await formatFiles(tree);

  return () => {
    installPackagesTask(tree);
  };
}
