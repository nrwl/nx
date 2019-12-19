export { readTsConfig } from './src/utils/typescript';
export {
  toPropertyName,
  toClassName,
  toFileName,
  names,
  findModuleParent
} from './src/utils/name-utils';
export {
  serializeJson,
  renameSync,
  updateJsonFile,
  readJsonFile,
  readWorkspaceConfigPath,
  copyFile
} from './src/utils/fileutils';
export {
  offsetFromRoot,
  ExistingPrettierConfig,
  resolveUserExistingPrettierConfig
} from './src/utils/common';
export { output } from './src/utils/output';
export {
  commandsObject,
  supportedNxCommands
} from './src/command-line/nx-commands';
export { readWorkspaceJson, readNxJson } from './src/core/file-utils';
export { NxJson } from './src/core/shared-interfaces';
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
  getProjectGraphFromHost,
  readWorkspace,
  renameSyncInTree,
  renameDirSyncInTree
} from './src/utils/ast-utils';

export {
  getNpmScope,
  getWorkspacePath,
  replaceAppNameWithPath,
  editTarget,
  parseTarget,
  serializeTarget
} from './src/utils/cli-config-utils';

export { getWorkspace, updateWorkspace } from './src/utils/workspace';
export { addUpdateTask } from './src/utils/update-task';
export { addLintFiles, generateProjectLint, Linter } from './src/utils/lint';

export { formatFiles } from './src/utils/rules/format-files';
export { deleteFile } from './src/utils/rules/deleteFile';
export * from './src/utils/rules/ng-add';
export { updateKarmaConf } from './src/utils/rules/update-karma-conf';
import * as strings from './src/utils/strings';
export { checkAndCleanWithSemver } from './src/utils/version-utils';
export {
  updatePackagesInPackageJson
} from './src/utils/update-packages-in-package-json';

export const stringUtils = strings;
