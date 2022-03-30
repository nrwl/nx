import { FsTree } from 'nx/src/config/tree';
import type { Tree } from 'nx/src/config/tree';

/**
 * Creates a host for testing.
 */
export function createTree(): Tree {
  return new FsTree('/virtual', false);
}
