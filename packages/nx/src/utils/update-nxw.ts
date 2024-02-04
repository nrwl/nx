import {
  getNxWrapperContents,
  nxWrapperPath,
} from '../command-line/init/implementation/dot-nx/add-nx-scripts';
import type { Tree } from '../generators/tree';
import { normalizePath } from '../utils/path';

export function updateNxw(tree: Tree) {
  const wrapperPath = normalizePath(nxWrapperPath());
  if (tree.exists(wrapperPath)) {
    tree.write(wrapperPath, getNxWrapperContents());
  }
}
