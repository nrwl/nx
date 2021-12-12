import { Tree, updateJson } from '@nrwl/devkit';
import { NormalizedGeneratorOptions } from '../schema';

export function addPathMapping(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  updateJson(tree, 'tsconfig.base.json', (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    c.paths[options.secondaryEntryPoint] = [
      `${options.libraryProject.root}/${options.name}/src/index.ts`,
    ];

    return json;
  });
}
