import { readNxJson, Tree, updateNxJson } from 'nx/src/devkit-exports';

export function addBuildTargetDefaults(
  tree: Tree,
  executorName: string,
  buildTargetName = 'build'
): void {
  const nxJson = readNxJson(tree);
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults[executorName] ??= {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs:
      nxJson.namedInputs && 'production' in nxJson.namedInputs
        ? ['production', '^production']
        : ['default', '^default'],
  };
  updateNxJson(tree, nxJson);
}
