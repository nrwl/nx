import type { Tree } from '@nrwl/devkit';
import {
  getWorkspaceLayout,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';

export function updateTsConfig(tree: Tree, project: string): void {
  const workerTsConfigPath = joinPathFragments(
    getWorkspaceLayout(tree).appsDir,
    project,
    'tsconfig.worker.json'
  );
  const { root } = readProjectConfiguration(tree, project);
  updateJson(tree, workerTsConfigPath, (json) => {
    json.extends = `${offsetFromRoot(root)}tsconfig.base.json`;
    return json;
  });
}
