import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/node'], []));
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/node': nxVersion },
      undefined,
      options.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

function addProjectGraphPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.pluginsConfig ??= {};
  const jsPluginConfig =
    (nxJson.pluginsConfig['@nx/js'] as Record<string, unknown> | undefined) ??
    {};

  nxJson.pluginsConfig['@nx/js'] = {
    ...jsPluginConfig,
    dependencyNarrowing: {
      respectSideEffects: true,
      removeTypeOnlyEdges: true,
      fallbackToStaticGraph: true,
      affectedNarrowing: true,
      ...(jsPluginConfig.dependencyNarrowing as
        | Record<string, unknown>
        | undefined),
    },
  };

  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, options: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree, options);
  }

  addProjectGraphPlugin(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;
