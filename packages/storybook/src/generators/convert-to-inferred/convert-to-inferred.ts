import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { migrateExecutorToPluginV1 } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';
import { servePostTargetTransformer } from './lib/serve-post-target-transformer';
import { createNodes } from '../../plugins/plugin';
import { storybookVersion } from '../../utils/versions';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migrationLogs = new AggregatedLog();
  const migratedBuildProjects = await migrateExecutorToPluginV1(
    tree,
    projectGraph,
    '@nx/storybook:build',
    '@nx/storybook/plugin',
    (targetName) => ({
      buildStorybookTargetName: targetName,
      serveStorybookTargetName: 'storybook',
      staticStorybookTargetName: 'static-storybook',
      testStorybookTargetName: 'test-storybook',
    }),
    buildPostTargetTransformer(migrationLogs),
    createNodes,
    options.project
  );

  const migratedServeProjects = await migrateExecutorToPluginV1(
    tree,
    projectGraph,
    '@nx/storybook:storybook',
    '@nx/storybook/plugin',
    (targetName) => ({
      buildStorybookTargetName: 'build-storybook',
      serveStorybookTargetName: targetName,
      staticStorybookTargetName: 'static-storybook',
      testStorybookTargetName: 'test-storybook',
    }),
    servePostTargetTransformer(migrationLogs),
    createNodes,
    options.project
  );

  const migratedProjects =
    migratedBuildProjects.size + migratedServeProjects.size;
  if (migratedProjects === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    { storybook: storybookVersion }
  );

  return runTasksInSerial(installTask, () => {
    migrationLogs.flushLogs();
  });
}

export default convertToInferred;
