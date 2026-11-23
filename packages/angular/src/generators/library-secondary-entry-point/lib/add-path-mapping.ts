import { Tree, updateJson } from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import { NormalizedGeneratorOptions } from '../schema';

export function addPathMapping(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const rootTsConfigPath = getRootTsConfigPathInTree(tree);
  if (!rootTsConfigPath) {
    throw new Error('Cannot find the root TypeScript configuration file.');
  }
  updateJson(tree, rootTsConfigPath, (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    c.paths[options.secondaryEntryPoint] = [
      `./${options.libraryProject.root}/${options.name}/src/index.ts`,
    ];

    return json;
  });
}
