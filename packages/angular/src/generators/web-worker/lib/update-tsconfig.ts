import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';

export function updateTsConfig(tree: Tree, project: string): void {
  const { root } = readProjectConfiguration(tree, project);
  const workerTsConfigPath = joinPathFragments(root, 'tsconfig.worker.json');
  updateJson(tree, workerTsConfigPath, (json) => {
    json.extends = offsetFromRoot(root) + getRootTsConfigPathInTree(tree);
    return json;
  });
}
