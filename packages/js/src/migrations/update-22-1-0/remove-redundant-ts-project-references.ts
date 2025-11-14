import type { Tree } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '../../utils/typescript/ts-solution-setup';
import { syncGenerator } from '../../generators/typescript-sync/typescript-sync';

export default async function (tree: Tree) {
  // Skip if not using TypeScript solution setup
  if (!isUsingTsSolutionSetup(tree)) {
    return;
  }

  await syncGenerator(tree);
}
