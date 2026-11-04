import { createProjectGraphAsync, formatFiles, type Tree } from '@nx/devkit';
import {
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
} from '@nx/devkit/internal';
import { createNodesV2, VitestPluginOptions } from '../../plugins/plugin';
import { testPostTargetTransformer } from './lib/test-post-target-transformer';
import { assertSupportedVitestVersion } from '../../utils/assert-supported-vitest-version';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  assertSupportedVitestVersion(tree);

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
          // The executor ran once unless asked to watch. Set per target, not as a
          // default, so an existing registration in watch mode is not reused.
          targetPluginOptionMapper: (target) => ({
            testTargetName: target,
            testMode: 'run',
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
}

export default convertToInferred;
