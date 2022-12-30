import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { getRelativePathToRootTsConfig } from '@nrwl/workspace/src/utilities/typescript';

export function updateTsConfig(tree: Tree, project: string): void {
  const { root } = readProjectConfiguration(tree, project);
  const workerTsConfigPath = joinPathFragments(root, 'tsconfig.worker.json');
  updateJson(tree, workerTsConfigPath, (json) => {
    json.extends = getRelativePathToRootTsConfig(tree, root);
    return json;
  });
}
