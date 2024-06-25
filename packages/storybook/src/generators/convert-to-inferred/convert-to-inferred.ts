import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { migrateProjectExecutorsToPluginV1 } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
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
  const migratedProjects = await migrateProjectExecutorsToPluginV1(
    tree,
    projectGraph,
    '@nx/storybook/plugin',
    createNodes,
    {
      buildStorybookTargetName: 'build-storybook',
      serveStorybookTargetName: 'storybook',
      staticStorybookTargetName: 'static-storybook',
      testStorybookTargetName: 'test-storybook',
    },
    [
      {
        executors: ['@nx/storybook:build', '@nrwl/storybook:build'],
        postTargetTransformer: buildPostTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          buildStorybookTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/storybook:storybook', '@nrwl/storybook:storybook'],
        postTargetTransformer: servePostTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          serveStorybookTargetName: targetName,
        }),
      },
    ],
    options.project
  );

  if (migratedProjects.size === 0) {
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
