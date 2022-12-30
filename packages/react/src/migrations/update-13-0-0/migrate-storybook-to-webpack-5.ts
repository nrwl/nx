import { Tree, logger, updateJson, readJson } from '@nrwl/devkit';
import {
  migrateToWebPack5,
  workspaceHasStorybookForReact,
} from './webpack5-changes-utils';

let needsInstall = false;

export async function migrateStorybookToWebPack5(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');
  if (workspaceHasStorybookForReact(packageJson)) {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = json.dependencies || {};
      json.devDependencies = json.devDependencies || {};

      if (
        !json.dependencies['@storybook/builder-webpack5'] &&
        !json.devDependencies['@storybook/builder-webpack5']
      ) {
        needsInstall = true;
        json.devDependencies['@storybook/builder-webpack5'] =
          workspaceHasStorybookForReact(packageJson);
      }

      if (
        !json.dependencies['@storybook/manager-webpack5'] &&
        !json.devDependencies['@storybook/manager-webpack5']
      ) {
        needsInstall = true;
        json.devDependencies['@storybook/manager-webpack5'] =
          workspaceHasStorybookForReact(packageJson);
      }

      return json;
    });
    await migrateToWebPack5(tree);

    if (needsInstall) {
      logger.info(
        'Please make sure to run npm install or yarn install to get the latest packages added by this migration'
      );
    }
  }
}

export default migrateStorybookToWebPack5;
