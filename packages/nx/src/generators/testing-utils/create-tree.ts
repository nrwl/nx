import { FsTree } from 'nx/src/generators/tree';
import type { Tree } from 'nx/src/generators/tree';

/**
 * Creates a host for testing.
 */
export function createTree(): Tree {
  return new FsTree('/virtual', false);
}
