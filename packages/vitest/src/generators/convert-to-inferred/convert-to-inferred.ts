import { createProjectGraphAsync, formatFiles, type Tree } from '@nx/devkit';
import {
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
} from '@nx/devkit/internal';
import { createNodesV2, VitestPluginOptions } from '../../plugins/plugin';
import { testPostTargetTransformer } from './lib/test-post-target-transformer';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();

  const migratedProjects =
    await migrateProjectExecutorsToPlugin<VitestPluginOptions>(
      tree,
      projectGraph,
      '@nx/vitest',
      createNodesV2,
      { testTargetName: 'test' },
      [
        {
          executors: ['@nx/vitest:test'],
          postTargetTransformer: testPostTargetTransformer,
          targetPluginOptionMapper: (target) => ({ testTargetName: target }),
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
}

export default convertToInferred;
