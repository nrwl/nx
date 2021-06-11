import { FsTree } from '@nrwl/tao/src/shared/tree';
import type { Tree } from '@nrwl/tao/src/shared/tree';

/**
 * Creates a host for testing.
 */
export function createTree(): Tree {
  return new FsTree('/virtual', false);
}
