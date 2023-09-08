import type { Tree } from '@nx/devkit';
import { moveGeneratorInternal } from '@nx/workspace/src/generators/move/move';
import type { Schema } from './schema';

export async function angularMoveGenerator(
  tree: Tree,
  schema: Schema
): Promise<void> {
  await angularMoveGeneratorInternal(tree, {
    projectNameAndRootFormat: 'derived',
    ...schema,
  });
}

export async function angularMoveGeneratorInternal(
  tree: Tree,
  schema: Schema
): Promise<void> {
  process.env.NX_ANGULAR_MOVE_INVOKED = 'true';
  await moveGeneratorInternal(tree, schema);
}
