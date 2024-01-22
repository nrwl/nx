import { readJson, type Tree } from '@nx/devkit';
import { addTsConfigPath, getRootTsConfigPathInTree } from '@nx/js';

type AddPathToTsConfigOptions = {
  remoteName: string;
  moduleName: string;
  pathToFile: string;
};

export function addPathToTsConfig(
  tree: Tree,
  { remoteName, moduleName, pathToFile }: AddPathToTsConfigOptions
) {
  const rootTsConfig = readJson(tree, getRootTsConfigPathInTree(tree));
  if (!rootTsConfig.compilerOptions?.paths[`${remoteName}/${moduleName}`]) {
    addTsConfigPath(tree, `${remoteName}/${moduleName}`, [pathToFile]);
  }
}
