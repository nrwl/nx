import {
  type Tree,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  addDependenciesToPackageJson,
  runTasksInSerial,
  createProjectGraphAsync,
} from '@nx/devkit';
import {
  addPluginV1,
  generateCombinations,
} from '@nx/devkit/src/utils/add-plugin';
import { createNodes } from '../../plugins/plugin';
import { nxVersion, remixVersion } from '../../utils/versions';
import { type Schema } from './schema';

export function remixInitGenerator(tree: Tree, options: Schema) {
  return remixInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function remixInitGeneratorInternal(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];

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
      options.keepExistingVersions
    );
    tasks.push(installTask);
  }

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;
  if (options.addPlugin) {
    await addPluginV1(
      tree,
      await createProjectGraphAsync(),
      '@nx/remix/plugin',
      createNodes,
      {
        startTargetName: ['start', 'remix:start', 'remix-start'],
        buildTargetName: ['build', 'remix:build', 'remix-build'],
        devTargetName: ['dev', 'remix:dev', 'remix-dev'],
        typecheckTargetName: [
          'typecheck',
          'remix:typecheck',
          'remix-typecheck',
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
