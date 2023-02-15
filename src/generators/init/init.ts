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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    '@nrwl/rspack': require('../../../package.json').version,
    '@rspack/core': rspackCoreVersion,
    '@rspack/plugin-minify': rspackPluginMinifyVersion,
  };

  if (schema.style === 'less') {
    devDependencies['@rspack/less-loader'] = rspackLessLoaderVersion;
  }

  if (schema.uiFramework !== 'none' || schema.devServer) {
    devDependencies['@rspack/dev-server'] = rspackDevServerVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}

export default rspackInitGenerator;

export const rspackInitSchematic = convertNxGenerator(rspackInitGenerator);
