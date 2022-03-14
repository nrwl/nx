import { FsTree } from 'nx/src/shared/tree';
import type { Tree } from 'nx/src/shared/tree';

/**
 * Creates a host for testing.
 */
export function createTree(): Tree {
  return new FsTree('/virtual', false);
}
