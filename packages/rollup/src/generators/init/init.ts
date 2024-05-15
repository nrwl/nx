import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodes } from '../../plugins/plugin';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  let task: GeneratorCallback = () => {};

  if (!schema.skipPackageJson) {
    task = addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/rollup': nxVersion },
      undefined,
      schema.keepExistingVersions
    );
  }

  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';
  if (schema.addPlugin) {
    await addPlugin(
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
