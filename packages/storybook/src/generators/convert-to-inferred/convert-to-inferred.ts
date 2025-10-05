import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
} from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';
import { servePostTargetTransformer } from './lib/serve-post-target-transformer';
import { createNodesV2 } from '../../plugins/plugin';
import { storybookVersion } from '../../utils/versions';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migrationLogs = new AggregatedLog();
  const migratedProjects = await migrateProjectExecutorsToPlugin(
    tree,
    projectGraph,
    '@nx/storybook/plugin',
    createNodesV2,
    {
      buildStorybookTargetName: 'build-storybook',
      serveStorybookTargetName: 'storybook',
      staticStorybookTargetName: 'static-storybook',
      testStorybookTargetName: 'test-storybook',
    },
    [
      {
        executors: ['@nx/storybook:build'],
        postTargetTransformer: buildPostTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          buildStorybookTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/storybook:storybook'],
        postTargetTransformer: servePostTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          serveStorybookTargetName: targetName,
        }),
      },
    ],
    options.project
  );

  if (migratedProjects.size === 0) {
    throw new NoTargetsToMigrateError();
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
