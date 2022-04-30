export { readTsConfig } from './src/utilities/typescript';
export { ProjectType, projectRootDir } from './src/utils/project-type';
export {
  renameSync,
  updateJsonFile,
  copyFile,
  createDirectory,
} from './src/utilities/fileutils';

export { names } from '@nrwl/devkit';

export {
  ExistingPrettierConfig,
  resolveUserExistingPrettierConfig,
} from './src/utilities/prettier';

export { output } from './src/utilities/output';

export {
  readWorkspaceJson,
  readNxJson,
  readWorkspaceConfig,
  readPackageJson,
} from 'nx/src/project-graph/file-utils';
export { ProjectGraphCache } from 'nx/src/project-graph/nx-deps-cache';
export {
  readJsonInTree,
  updateJsonInTree,
  updateWorkspaceInTree,
  insert,
  replaceNodeValue,
  addDepsToPackageJson,
  addMethod,
  addIncludeToTsConfig,
  addGlobal,
  getProjectConfig,
  addParameterToConstructor,
  createOrUpdate,
  findNodes,
  updatePackageJsonDependencies,
  readWorkspace,
  renameSyncInTree,
  renameDirSyncInTree,
  updateNxJsonInTree,
  readNxJsonInTree,
  InsertChange,
  ReplaceChange,
  RemoveChange,
} from './src/utils/ast-utils';

export {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath,
  editTarget,
  parseTarget,
  serializeTarget,
} from './src/utils/cli-config-utils';

export { unparse } from 'nx/src/tasks-runner/utils';

export {
  getWorkspace,
  updateWorkspace,
  updateBuilderConfig,
} from './src/utils/workspace';
export { addUpdateTask } from './src/utils/update-task';
export { addLintFiles, generateProjectLint, Linter } from './src/utils/lint';

export { addInstallTask } from './src/utils/rules/add-install-task';
export { formatFiles } from './src/utils/rules/format-files';
export { deleteFile } from './src/utils/rules/deleteFile';
export * from './src/utils/rules/ng-add';
export { updateKarmaConf } from './src/utils/rules/update-karma-conf';
export { visitNotIgnoredFiles } from './src/utils/rules/visit-not-ignored-files';
export { setDefaultCollection } from './src/utils/rules/workspace';
export { renamePackageImports } from './src/utils/rules/rename-package-imports';
export { renameNpmPackages } from './src/utils/rules/rename-npm-packages';
import * as strings from './src/utils/strings';
export { checkAndCleanWithSemver } from './src/utils/version-utils';
export { updatePackagesInPackageJson } from './src/utils/update-packages-in-package-json';

export { libraryGenerator } from './src/generators/library/library';
export { moveGenerator } from './src/generators/move/move';
export { removeGenerator } from './src/generators/remove/remove';
export { runCommandsGenerator } from './src/generators/run-commands/run-commands';
export {
  convertToNxProjectGenerator,
  convertToNxProjectSchematic,
} from './src/generators/convert-to-nx-project/convert-to-nx-project';

export const stringUtils = strings;
