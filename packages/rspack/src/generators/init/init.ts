import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  createProjectGraphAsync,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator } from '@nx/js';
import { createNodesV2 } from '../../../plugin';
import {
  lessLoaderVersion,
  reactRefreshVersion,
  sassEmbeddedVersion,
  sassLoaderVersion,
} from '../../utils/versions';
import { getRspackVersionsForInstalledMajor } from '../../utils/version-utils';
import { assertSupportedRspackVersion } from '../../utils/assert-supported-rspack-version';
import { InitGeneratorSchema } from './schema';

export async function rspackInitGenerator(
  tree: Tree,
  schema: InitGeneratorSchema
) {
  assertSupportedRspackVersion(tree);

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
        serveStaticTargetName: [
          'serve-static',
          'rspack:serve-static',
          'rspack-serve-static',
        ],
        previewTargetName: [
          'preview',
          'rspack:preview',
          'preview:rspack',
          'rspack-preview',
          'preview-rspack',
        ],
        buildDepsTargetName: [
          'build-deps',
          'rspack:build-deps',
          'rspack-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'rspack:watch-deps',
          'rspack-watch-deps',
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

  const rspackVersions = getRspackVersionsForInstalledMajor(tree);
  const keepExistingVersions = schema.keepExistingVersions ?? true;

  const devDependencies = {
    '@rspack/core': rspackVersions.rspackCoreVersion,
    '@rspack/cli': rspackVersions.rspackCoreVersion,
    '@rspack/dev-server': rspackVersions.rspackDevServerVersion,
    ...(!schema.framework || schema.framework === 'react'
      ? {
          '@rspack/plugin-react-refresh':
            rspackVersions.rspackPluginReactRefreshVersion,
          'react-refresh': reactRefreshVersion,
        }
      : {}),
  };

  const version = require('../../../package.json').version;
  if (version !== '0.0.1') {
    // Ignored for local dev / e2e tests.
    devDependencies['@nx/rspack'] = version;
  }

  if (schema.style === 'less') {
    devDependencies['less-loader'] = lessLoaderVersion;
  }
  if (schema.style === 'scss') {
    devDependencies['sass-loader'] = sassLoaderVersion;
    devDependencies['sass-embedded'] = sassEmbeddedVersion;
  }

  if (schema.framework !== 'none' || schema.devServer) {
    devDependencies['@rspack/dev-server'] =
      rspackVersions.rspackDevServerVersion;
  }

  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    devDependencies,
    undefined,
    keepExistingVersions
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}

export default rspackInitGenerator;

export const rspackInitSchematic = convertNxGenerator(rspackInitGenerator);
