import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  createProjectGraphAsync,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { initGenerator } from '@nx/js';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { createNodesV2 } from '../../../plugin';
import {
  lessLoaderVersion,
  reactRefreshVersion,
  rspackCoreVersion,
  rspackDevServerVersion,
  rspackPluginMinifyVersion,
  rspackPluginReactRefreshVersion,
} from '../../utils/versions';
import { InitGeneratorSchema } from './schema';

export async function rspackInitGenerator(
  tree: Tree,
  schema: InitGeneratorSchema
) {
  assertNotUsingTsSolutionSetup(tree, 'rspack', 'init');

  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/rspack/plugin',
      createNodesV2,
      {
        buildTargetName: [
          'build',
          'rspack:build',
          'build:rspack',
          'rspack-build',
          'build-rspack',
        ],
        serveTargetName: [
          'serve',
          'rspack:serve',
          'serve:rspack',
          'rspack-serve',
          'serve-rspack',
        ],
        previewTargetName: [
          'preview',
          'rspack:preview',
          'preview:rspack',
          'rspack-preview',
          'preview-rspack',
        ],
      },
      schema.updatePackageScripts
    );
  }

  const jsInitTask = await initGenerator(tree, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
  });

  tasks.push(jsInitTask);

  const devDependencies = {
    '@rspack/core': rspackCoreVersion,
    '@rspack/cli': rspackCoreVersion,
    '@rspack/plugin-minify': rspackPluginMinifyVersion,
    '@rspack/plugin-react-refresh': rspackPluginReactRefreshVersion,
    'react-refresh': reactRefreshVersion,
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const version = require('../../../package.json').version;
  if (version !== '0.0.1') {
    // Ignored for local dev / e2e tests.
    devDependencies['@nx/rspack'] = version;
  }

  if (schema.style === 'less') {
    devDependencies['less-loader'] = lessLoaderVersion;
  }

  if (schema.framework !== 'none' || schema.devServer) {
    devDependencies['@rspack/dev-server'] = rspackDevServerVersion;
  }

  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    devDependencies,
    undefined,
    schema.keepExistingVersions
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}

export default rspackInitGenerator;

export const rspackInitSchematic = convertNxGenerator(rspackInitGenerator);
