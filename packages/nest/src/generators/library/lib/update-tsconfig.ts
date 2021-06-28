import type { Tree } from '@nrwl/devkit';
import { readProjectConfiguration, updateJson } from '@nrwl/devkit';
import type { NormalizedOptions } from '../schema';

export function updateTsConfig(tree: Tree, options: NormalizedOptions): void {
  const project = readProjectConfiguration(tree, options.projectName);

  return updateJson(tree, `${project.root}/tsconfig.lib.json`, (json) => {
    json.compilerOptions.target = options.target;
    if (options.strict) {
      json.compilerOptions = {
        ...json.compilerOptions,
        forceConsistentCasingInFileNames: true,
        strict: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
      };
    }

    return json;
  });
}
