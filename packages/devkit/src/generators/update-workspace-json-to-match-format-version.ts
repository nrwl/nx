import { reformattedWorkspaceJsonOrNull } from '@nrwl/tao/src/shared/workspace';

import { getWorkspacePath } from '../utils/get-workspace-layout';
import { readJson, writeJson } from '../utils/json';

import type { Tree } from '@nrwl/tao/src/shared/tree';

export function updateWorkspaceJsonToMatchFormatVersion(tree: Tree): void {
  const path = getWorkspacePath(tree);
  if (!path) {
    return;
  }

  try {
    const workspaceJson = readJson(tree, path);
    const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
    if (reformatted) {
      writeJson(tree, path, reformatted);
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}
