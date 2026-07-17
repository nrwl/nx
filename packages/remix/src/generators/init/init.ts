import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/plugin';
import { assertAndPinRemixTypescript } from '../../utils/assert-and-pin-remix-typescript';
import {
  assertSupportedRemixVersion,
  nxVersion,
  remixVersion,
} from '../../utils/versions';
import { type Schema } from './schema';

export function remixInitGenerator(tree: Tree, options: Schema) {
  return remixInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function remixInitGeneratorInternal(tree: Tree, options: Schema) {
  assertSupportedRemixVersion(tree);

  const tasks: GeneratorCallback[] = [];

  tasks.push(assertAndPinRemixTypescript(tree));

  if (!options.skipPackageJson) {
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@remix-run/serve': remixVersion,
      },
      {
        '@nx/web': nxVersion,
        '@remix-run/dev': remixVersion,
      },
      undefined,
      options.keepExistingVersions ?? true
    );
    tasks.push(installTask);
  }

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;
  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/remix/plugin',
      createNodesV2,
      {
        startTargetName: ['start', 'remix:start', 'remix-start'],
        buildTargetName: ['build', 'remix:build', 'remix-build'],
        devTargetName: ['dev', 'remix:dev', 'remix-dev'],
        typecheckTargetName: [
          'typecheck',
          'remix:typecheck',
          'remix-typecheck',
        ],
        serveStaticTargetName: [
          'serve-static',
          'remix:serve-static',
          'remix-serve-static',
        ],
        buildDepsTargetName: [
          'build-deps',
          'remix:build-deps',
          'remix-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'remix:watch-deps',
          'remix-watch-deps',
        ],
      },
      options.updatePackageScripts
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default remixInitGenerator;
