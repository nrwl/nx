import type { Tree } from '@nx/devkit';
import { moveGenerator } from '@nx/workspace/src/generators/move/move';
import type { Schema } from './schema';

/**
 * @deprecated Use the `@nx/workspace:move` generator instead. It will be removed in Nx v22.
 */
export async function angularMoveGenerator(
  tree: Tree,
  schema: Schema
): Promise<void> {
  process.env.NX_ANGULAR_MOVE_INVOKED = 'true';
  await moveGenerator(tree, schema);
}
