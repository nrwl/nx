import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  Tree,
} from '@nx/devkit';
import {
  nxVersion,
  rollupVersion,
  assertSupportedRollupVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import { createNodesV2 } from '../../plugins/plugin';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  assertSupportedRollupVersion(tree);

  let task: GeneratorCallback = () => {};
  const nxJson = readNxJson(tree);
  schema.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  if (!schema.skipPackageJson) {
    // Rollup is a peer dependency, so ensure it is installed for both the
    // inferred-plugin (CLI) path and the executor (programmatic) path.
    const devDependencies = {
      '@nx/rollup': nxVersion,
      rollup: rollupVersion,
    };
    task = addDependenciesToPackageJson(
      tree,
      {},
      devDependencies,
      undefined,
      schema.keepExistingVersions ?? true
    );
  }

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/rollup/plugin',
      createNodesV2,
      {
        buildTargetName: ['build', 'rollup:build', 'rollup-build'],
        buildDepsTargetName: [
          'build-deps',
          'rollup:build-deps',
          'rollup-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'rollup:watch-deps',
          'rollup-watch-deps',
        ],
      },
      schema.updatePackageScripts
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default rollupInitGenerator;
