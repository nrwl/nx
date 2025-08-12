import { readJson, updateJson, type Tree } from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';

/**
 * This is a temporary fix for Storybook to support TypeScript configuration files.
 * The issue is that if there is a root tsconfig.json file, Storybook will use it, and
 * ignore the tsconfig.json file in the .storybook folder. This results in module being set
 * to esnext, and Storybook does not recognise the main.ts code as a module.
 */
export function editRootTsConfig(tree: Tree) {
  if (!tree.exists('tsconfig.json')) {
    return;
  }

  updateJson(tree, 'tsconfig.json', (json) => {
    json['ts-node'] ??= {};
    json['ts-node'].compilerOptions ??= {};
    json['ts-node'].compilerOptions.module = 'commonjs';
    json['ts-node'].compilerOptions.moduleResolution = 'node10';

    if (json.compilerOptions?.customConditions) {
      json['ts-node'].compilerOptions.customConditions = null;
    } else {
      const rootTsconfigFile = getRootTsConfigFileName(tree);
      if (rootTsconfigFile) {
        const rootTsconfigJson = readJson(tree, rootTsconfigFile);
        if (rootTsconfigJson.compilerOptions?.customConditions) {
          json['ts-node'].compilerOptions.customConditions = null;
        }
      }
    }

    return json;
  });
}
