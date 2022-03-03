import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { getRootTsConfigPath } from '../../utils/typescript';

export function updateTsConfig(tree: Tree, project: string): void {
  const { root } = readProjectConfiguration(tree, project);
  const workerTsConfigPath = joinPathFragments(root, 'tsconfig.worker.json');
  updateJson(tree, workerTsConfigPath, (json) => {
    json.extends = `${offsetFromRoot(root)}${getRootTsConfigPath(tree)}`;
    return json;
  });
}
