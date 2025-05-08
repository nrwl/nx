import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { nxVersion, rollupVersion } from '../../utils/versions';
import { Schema } from './schema';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../plugins/plugin';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  let task: GeneratorCallback = () => {};
  const nxJson = readNxJson(tree);
  schema.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  if (!schema.skipPackageJson) {
    const devDependencies = { '@nx/rollup': nxVersion };
    if (schema.addPlugin) {
      // Ensure user can run Rollup CLI.
      devDependencies['rollup'] = rollupVersion;
    }
    task = addDependenciesToPackageJson(
      tree,
      {},
      devDependencies,
      undefined,
      schema.keepExistingVersions
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
