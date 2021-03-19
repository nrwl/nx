export { Tree, FileChange } from '@nrwl/tao/src/shared/tree';
export {
  WorkspaceJsonConfiguration,
  TargetConfiguration,
  ProjectConfiguration,
  ProjectType,
  Generator,
  GeneratorCallback,
  Executor,
  ExecutorContext,
} from '@nrwl/tao/src/shared/workspace';
export {
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/tao/src/shared/nx';
export { logger } from '@nrwl/tao/src/shared/logger';
export { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
export { runExecutor, Target } from '@nrwl/tao/src/commands/run';

export { formatFiles } from './src/generators/format-files';
export { generateFiles } from './src/generators/generate-files';
export {
  WorkspaceConfiguration,
  addProjectConfiguration,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
  getProjects,
} from './src/generators/project-configuration';
export { toJS } from './src/generators/to-js';
export { updateTsConfigsToJs } from './src/generators/update-ts-configs-to-js';
export { visitNotIgnoredFiles } from './src/generators/visit-not-ignored-files';

export { parseTargetString } from './src/executors/parse-target-string';
export { readTargetOptions } from './src/executors/read-target-options';

export { readJson, writeJson, updateJson } from './src/utils/json';
export {
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
} from './src/utils/package-json';
export { installPackagesTask } from './src/tasks/install-packages-task';
export { names } from './src/utils/names';
export {
  getWorkspaceLayout,
  getWorkspacePath,
} from './src/utils/get-workspace-layout';
export {
  applyChangesToString,
  ChangeType,
  StringChange,
  StringDeletion,
  StringInsertion,
} from './src/utils/string-change';
export { offsetFromRoot } from './src/utils/offset-from-root';
export { convertNxGenerator } from './src/utils/invoke-nx-generator';
export { convertNxExecutor } from './src/utils/convert-nx-executor';
export { stripIndents } from './src/utils/strip-indents';
export { joinPathFragments, normalizePath } from './src/utils/path';
