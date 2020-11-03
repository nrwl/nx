import { FsTree } from '@nrwl/tao/src/shared/tree';

export function createTreeWithEmptyWorkspace() {
  const tree = new FsTree(null, false, console);
  return tree;
}
