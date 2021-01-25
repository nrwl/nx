import { FsTree } from '@nrwl/tao/src/shared/tree';

/**
 * Creates a host for testing.
 */
export function createTree() {
  return new FsTree('/virtual', false);
}
