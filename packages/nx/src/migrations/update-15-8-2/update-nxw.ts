import {
  getNxWrapperContents,
  nxWrapperPath,
} from '../../nx-init/dot-nx/add-nx-scripts';
import { normalizePath } from '../../utils/path';
import { Tree } from '../../generators/tree';

export default async function (tree: Tree) {
  const wrapperPath = normalizePath(nxWrapperPath());
  if (tree.exists(wrapperPath)) {
    tree.write(wrapperPath, getNxWrapperContents());
  }
}
