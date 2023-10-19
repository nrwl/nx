import { Tree } from '@nx/devkit';

export function useFlatConfig(tree: Tree): boolean {
  return tree.exists('eslint.config.js');
}
