import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes, WebpackPluginOptions } from '../../plugins/plugin';
import { nxVersion, webpackCliVersion } from '../../utils/versions';
import { Schema } from './schema';

export function webpackInitGenerator(tree: Tree, schema: Schema) {
  return webpackInitGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function webpackInitGeneratorInternal(tree: Tree, schema: Schema) {
  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  if (schema.addPlugin) {
    addPlugin(tree);
  }

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    const devDependencies = {
      '@nx/webpack': nxVersion,
      '@nx/web': nxVersion,
    };

    if (schema.addPlugin) {
      devDependencies['webpack-cli'] = webpackCliVersion;
    }

    installTask = addDependenciesToPackageJson(
      tree,
      {},
      devDependencies,
      undefined,
      schema.keepExistingVersions
    );
  }

  if (schema.updatePackageScripts) {
    await updatePackageScripts(tree, createNodes);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/webpack/plugin'
        : plugin.plugin === '@nx/webpack/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/webpack/plugin',
    options: {
      buildTargetName: 'build',
      serveTargetName: 'serve',
      previewTargetName: 'preview',
    } as WebpackPluginOptions,
  });
  updateNxJson(tree, nxJson);
}

export default webpackInitGenerator;
