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
import { addPluginV1 } from '@nx/devkit/src/utils/add-plugin';
import { createNodes } from '../../plugins/plugin';

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
    await addPluginV1(
      tree,
      await createProjectGraphAsync(),
      '@nx/rollup/plugin',
      createNodes,
      {
        buildTargetName: ['build', 'rollup:build', 'rollup-build'],
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
