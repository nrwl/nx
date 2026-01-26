import {
  getNxWrapperContents,
  nxWrapperPath,
  getShellScriptContents,
  getBatchScriptContents,
} from '../command-line/init/implementation/dot-nx/add-nx-scripts';
import type { Tree } from '../generators/tree';
import { normalizePath } from '../utils/path';
import { constants as FsConstants } from 'fs';

export function updateNxw(tree: Tree) {
  const wrapperPath = normalizePath(nxWrapperPath());
  if (tree.exists(wrapperPath)) {
    tree.write(wrapperPath, getNxWrapperContents());
  }

  const bashScriptPath = 'nx';
  if (tree.exists(bashScriptPath) && tree.isFile(bashScriptPath)) {
    tree.write(bashScriptPath, getShellScriptContents(), {
      mode: FsConstants.S_IXUSR | FsConstants.S_IRUSR | FsConstants.S_IWUSR,
    });
  }

  const batchScriptPath = 'nx.bat';
  if (tree.exists(batchScriptPath) && tree.isFile(batchScriptPath)) {
    tree.write(batchScriptPath, getBatchScriptContents());
  }
}
