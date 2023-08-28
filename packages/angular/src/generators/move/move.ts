import type { Tree } from '@nx/devkit';
import { moveGenerator } from '@nx/workspace/generators';
import type { Schema } from './schema';

export async function angularMoveGenerator(
  tree: Tree,
  schema: Schema
): Promise<void> {
  await moveGenerator(tree, schema);
}
