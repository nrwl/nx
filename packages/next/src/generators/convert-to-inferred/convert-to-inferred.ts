import { createProjectGraphAsync, formatFiles, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
} from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodesV2 } from '../../plugins/plugin';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';
import { servePosTargetTransformer } from './lib/serve-post-target-tranformer';

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
    '@nx/next/plugin',
    createNodesV2,
    {
      buildTargetName: 'build',
      devTargetName: 'dev',
      startTargetName: 'start',
      serveStaticTargetName: 'serve-static',
    },
    [
      {
        executors: ['@nx/next:build'],
        postTargetTransformer: buildPostTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          buildTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/next:server'],
        postTargetTransformer: servePosTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          devTargetName: targetName,
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

  return () => {
    migrationLogs.flushLogs();
  };
}

export default convertToInferred;
