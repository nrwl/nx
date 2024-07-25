import { readNxJson, Tree, updateNxJson } from 'nx/src/devkit-exports';
import type { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';

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

export function addTargetDefault(
  tree: Tree,
  targetOrExecutorName: string,
  target: TargetConfiguration
): void {
  const nxJson = readNxJson(tree);
  nxJson.targetDefaults ??= {};
  if (targetOrExecutorName in nxJson.targetDefaults) {
    // Do nothing, we do not want to replace user-defined config
    return;
  }

  nxJson.targetDefaults[targetOrExecutorName] = target;
  updateNxJson(tree, nxJson);
}
