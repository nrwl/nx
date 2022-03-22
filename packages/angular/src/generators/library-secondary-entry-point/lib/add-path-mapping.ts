import { Tree, updateJson } from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { NormalizedGeneratorOptions } from '../schema';

export function addPathMapping(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  updateJson(tree, getRootTsConfigPathInTree(tree), (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    c.paths[options.secondaryEntryPoint] = [
      `${options.libraryProject.root}/${options.name}/src/index.ts`,
    ];

    return json;
  });
}
