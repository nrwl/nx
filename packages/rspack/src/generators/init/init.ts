import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator } from '@nx/js';
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
  const tasks: GeneratorCallback[] = [];
  const jsInitTask = await initGenerator(tree, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
  });

  tasks.push(jsInitTask);

  const devDependencies = {
    '@rspack/core': rspackCoreVersion,
    '@rspack/plugin-minify': rspackPluginMinifyVersion,
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const version = require('../../../package.json').version;
  if (version !== '0.0.1') {
    // Ignored for local dev / e2e tests.
    devDependencies['@nx/rspack'] = version;
  }

  if (schema.style === 'less') {
    devDependencies['@rspack/less-loader'] = rspackLessLoaderVersion;
  }

  if (schema.framework !== 'none' || schema.devServer) {
    devDependencies['@rspack/dev-server'] = rspackDevServerVersion;
  }

  const installTask = addDependenciesToPackageJson(tree, {}, devDependencies);
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}

export default rspackInitGenerator;

export const rspackInitSchematic = convertNxGenerator(rspackInitGenerator);
