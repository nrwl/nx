import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes } from '../../plugins/plugin';

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/rollup/plugin'
        : plugin.plugin === '@nx/rollup/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/rollup/plugin',
    options: {
      buildTargetName: 'build',
    },
  });

  updateNxJson(tree, nxJson);
}

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
    addPlugin(tree);
  }

  if (schema.updatePackageScripts) {
    await updatePackageScripts(tree, createNodes);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default rollupInitGenerator;
