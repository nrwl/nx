import {
  type Tree,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  updateNxJson,
  addDependenciesToPackageJson,
  runTasksInSerial,
} from '@nx/devkit';
import { type Schema } from './schema';
import { nxVersion, remixVersion } from '../../utils/versions';

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

export async function remixInitGenerator(tree: Tree, options: Schema) {
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

  if (process.env.NX_PCV3 === 'true') {
    addPlugin(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default remixInitGenerator;
