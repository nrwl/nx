import {
  type Tree,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  updateNxJson,
  addDependenciesToPackageJson,
  runTasksInSerial,
} from '@nx/devkit';
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes } from '../../plugins/plugin';
import { nxVersion, remixVersion } from '../../utils/versions';
import { type Schema } from './schema';

function addPlugin(tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/remix/plugin'
        : plugin.plugin === '@nx/remix/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/remix/plugin',
    options: {
      buildTargetName: 'build',
      serveTargetName: 'serve',
      startTargetName: 'start',
      typecheckTargetName: 'typecheck',
    },
  });

  updateNxJson(tree, nxJson);
}

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

  if (options.addPlugin) {
    addPlugin(tree);
  }

  if (options.updatePackageScripts) {
    await updatePackageScripts(tree, createNodes);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default remixInitGenerator;
