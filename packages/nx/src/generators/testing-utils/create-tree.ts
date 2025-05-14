import { FsTree } from '../tree';
import type { Tree } from '../tree';

/**
 * Creates a host for testing.
 */
export function createTree(): Tree {
  const tree = new FsTree('/virtual', false);
  // Allow prettier formatting to be applied to the tree for backwards compatibility within v20
  // TODO: Decouple formatFiles and other formatting utilities from prettier to avoid this
  tree.write('.prettierrc', '{}');
  return tree;
}
