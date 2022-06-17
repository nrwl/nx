import type { Tree } from '@nrwl/devkit';
import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

export function setDefaultProject(tree: Tree, options: NormalizedSchema): void {
  const workspace = readWorkspaceConfiguration(tree);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.name;
    updateWorkspaceConfiguration(tree, workspace);
  }
}
