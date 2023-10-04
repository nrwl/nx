import { FsTree } from '../tree';
import type { Tree } from '../tree';

/**
 * Creates a host for testing.
 */
export function createTree(): Tree {
  return new FsTree('/virtual', false);
}
