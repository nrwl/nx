import {
  createProjectGraphAsync,
  formatFiles,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import {
  getExecutorTargets,
  updateNxJsonWithTargetDefaultsForExecutor,
} from '@nx/devkit/src/utils/update-nx-json-with-target-defaults-for-executor';

export default async function update(tree: Tree) {
  const executor = '@nx/webpack:webpack';
  const graph = await createProjectGraphAsync();

  const executorTargets = getExecutorTargets(graph, executor);

  // Workspace does not use jest?
  if (executorTargets.size === 0) {
    return;
  }

  let nxJson = readNxJson(tree);

  // Don't override anything if there are already target defaults for jest
  if (nxJson.targetDefaults?.[executor]) {
    return;
  }

  const executorDefaults = {
    cache: true,
    inputs: nxJson.namedInputs?.production
      ? ['production', '^production']
      : ['default', '^default'],
  };
  nxJson.targetDefaults ??= {};

  nxJson = updateNxJsonWithTargetDefaultsForExecutor(
    tree,
    nxJson,
    graph,
    executor,
    executorDefaults,
    executorTargets
  );

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
