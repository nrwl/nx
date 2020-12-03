export { Tree, FileChange } from '@nrwl/tao/src/shared/tree';
export {
  WorkspaceConfiguration,
  TargetConfiguration,
  ProjectConfiguration,
} from '@nrwl/tao/src/shared/workspace';
export {
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/tao/src/shared/nx';
export { TargetContext } from '@nrwl/tao/src/commands/run';
export { formatFiles } from './src/generators/format-files';
export { readJson } from './src/utils/read-json';
export { generateFiles } from './src/generators/generate-files';
export { installPackagesTask } from './src/tasks/install-packages-task';
export {
  addProjectConfiguration,
  readProjectConfiguration,
  updateProjectConfiguration,
} from './src/generators/project-configuration';
export { names } from './src/utils/names';
export { getWorkspaceLayout } from './src/utils/get-workspace-layout';
export { offsetFromRoot } from './src/utils/offset-from-root';
