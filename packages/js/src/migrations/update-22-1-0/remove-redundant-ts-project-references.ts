import type { Tree } from '@nx/devkit';
import { syncGenerator } from '../../generators/typescript-sync/typescript-sync';

export default async function (tree: Tree) {
  await syncGenerator(tree);
}
