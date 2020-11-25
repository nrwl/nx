import { FsTree } from '@nrwl/tao/src/shared/tree';

/**
 * Creates a host for testing.
 */
export function createTreeWithEmptyWorkspace() {
  const tree = new FsTree('/virtual', false, console);
  return tree;
}
