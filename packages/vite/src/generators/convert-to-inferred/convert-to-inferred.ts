import { createProjectGraphAsync, formatFiles, type Tree } from '@nx/devkit';
import { migrateProjectExecutorsToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodesV2, VitePluginOptions } from '../../plugins/plugin';
import { buildPostTargetTransformer } from './lib/build-post-target-transformer';
import { servePostTargetTransformer } from './lib/serve-post-target-transformer';
import { previewPostTargetTransformer } from './lib/preview-post-target-transformer';
import { testPostTargetTransformer } from './lib/test-post-target-transformer';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migrationLogs = new AggregatedLog();

  const migratedProjects =
    await migrateProjectExecutorsToPlugin<VitePluginOptions>(
      tree,
      projectGraph,
      '@nx/vite/plugin',
      createNodesV2,
      {
        buildTargetName: 'build',
        serveTargetName: 'serve',
        previewTargetName: 'preview',
        testTargetName: 'test',
        serveStaticTargetName: 'serve-static',
      },
      [
        {
          executors: ['@nx/vite:build'],
          postTargetTransformer: buildPostTargetTransformer,
          targetPluginOptionMapper: (target) => ({ buildTargetName: target }),
        },
        {
          executors: ['@nx/vite:dev-server'],
          postTargetTransformer: servePostTargetTransformer(migrationLogs),
          targetPluginOptionMapper: (target) => ({ serveTargetName: target }),
        },
        {
          executors: ['@nx/vite:preview-server'],
          postTargetTransformer: previewPostTargetTransformer(migrationLogs),
          targetPluginOptionMapper: (target) => ({ previewTargetName: target }),
        },
        {
          executors: ['@nx/vite:test'],
          postTargetTransformer: testPostTargetTransformer,
          targetPluginOptionMapper: (target) => ({ testTargetName: target }),
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

  return () => {
    migrationLogs.flushLogs();
  };
}

export default convertToInferred;
