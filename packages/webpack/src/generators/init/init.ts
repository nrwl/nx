import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { WebpackPluginOptions } from '../../plugins/plugin';
import { nxVersion, webpackCliVersion } from '../../utils/versions';
import { Schema } from './schema';

export async function webpackInitGenerator(tree: Tree, schema: Schema) {
  const shouldAddPlugin = process.env.NX_PCV3 === 'true';
  if (shouldAddPlugin) {
    addPlugin(tree);
  }

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    const devDependencies = {
      '@nx/webpack': nxVersion,
    };

    if (shouldAddPlugin) {
      devDependencies['webpack-cli'] = webpackCliVersion;
    }

    installTask = addDependenciesToPackageJson(tree, {}, devDependencies);
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
