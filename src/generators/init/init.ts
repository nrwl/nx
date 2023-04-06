import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  Tree,
} from '@nrwl/devkit';
import {
  rspackCoreVersion,
  rspackDevServerVersion,
  rspackLessLoaderVersion,
  rspackPluginMinifyVersion,
} from '../../utils/versions';
import { InitGeneratorSchema } from './schema';

export async function rspackInitGenerator(
  tree: Tree,
  schema: InitGeneratorSchema
) {
  const devDependencies = {
    '@rspack/core': rspackCoreVersion,
    '@rspack/plugin-minify': rspackPluginMinifyVersion,
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const version = require('../../../package.json').version;
  if (version !== '0.0.1') {
    // Ignored for local dev / e2e tests.
    devDependencies['@nrwl/rspack'] = version;
  }

  if (schema.style === 'less') {
    devDependencies['@rspack/less-loader'] = rspackLessLoaderVersion;
  }

  if (schema.framework !== 'none' || schema.devServer) {
    devDependencies['@rspack/dev-server'] = rspackDevServerVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}

export default rspackInitGenerator;

export const rspackInitSchematic = convertNxGenerator(rspackInitGenerator);
