import { updateJson, type Tree } from '@nx/devkit';

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
    if (json['ts-node']) {
      json['ts-node'] = {
        ...json['ts-node'],
        compilerOptions: {
          ...(json['ts-node'].compilerOptions ?? {}),
          module: 'commonjs',
        },
      };
    } else {
      json['ts-node'] = {
        compilerOptions: {
          module: 'commonjs',
        },
      };
    }
    return json;
  });
}
