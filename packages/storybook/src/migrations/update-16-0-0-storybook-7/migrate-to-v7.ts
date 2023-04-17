import { logger, readJson, Tree } from '@nx/devkit';
import * as semver from 'semver';
import migrate from '../../generators/migrate-7/migrate-7';

export default async function migrateStorybookV7(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');

  // In case someone installed into dependencies.
  const installedVersion =
    packageJson.devDependencies?.['@storybook/core-server'] ||
    packageJson.dependencies?.['@storybook/core-server'];

  if (installedVersion && semver.gte(installedVersion, '7.0.0')) {
    logger.info(`Storybook is already at v7. Skipping migration.`);
    return;
  }

  await migrate(tree, {
    autoAcceptAllPrompts: true,
  });
}
