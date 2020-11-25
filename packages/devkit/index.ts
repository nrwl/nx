export { Tree, FileChange } from '@nrwl/tao/src/shared/tree';
export {
  WorkspaceDefinition,
  TargetDefinition,
  ProjectDefinition,
} from '@nrwl/tao/src/shared/workspace';
export { NxJson, NxJsonProjectConfig } from '@nrwl/tao/src/shared/nx';
export { TargetContext } from '@nrwl/tao/src/commands/run';
export { formatFiles } from './src/schematics/format-files';
export { generateFiles } from './src/schematics/generate-files';
export { installPackagesTask } from './src/tasks/install-packages-task';
export { addProjectToWorkspace } from './src/schematics/add-project-to-workspace';
export { names } from './src/utils/names';
export {
  getWorkspaceLayout,
  getWorkspacePath,
} from './src/utils/get-workspace-layout';
export { offsetFromRoot } from './src/utils/offset-from-root';
