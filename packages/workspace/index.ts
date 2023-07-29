export { readTsConfig } from './src/utilities/ts-config';
export { ProjectType, projectRootDir } from './src/utils/project-type';
export {
  renameSync,
  updateJsonFile,
  copyFile,
  createDirectory,
} from './src/utilities/fileutils';

export { names } from '@nx/devkit';

export { output } from './src/utilities/output';

export {
  readWorkspaceConfig,
  readPackageJson,
} from 'nx/src/project-graph/file-utils';
export { ProjectFileMapCache } from 'nx/src/project-graph/nx-deps-cache';

export {
  getWorkspacePath,
  editTarget,
  parseTarget,
  serializeTarget,
} from './src/utils/cli-config-utils';

export {
  getWorkspace,
  updateWorkspace,
  updateBuilderConfig,
} from './src/utils/workspace';
export { Linter } from './src/utils/lint';

export { addInstallTask } from './src/utils/rules/add-install-task';
export { formatFiles } from './src/utils/rules/format-files';
export { deleteFile } from './src/utils/rules/deleteFile';

export { visitNotIgnoredFiles } from './src/utils/rules/visit-not-ignored-files';
import * as strings from './src/utils/strings';

// TODO(v17): Remove this export.
export { checkAndCleanWithSemver } from './src/utils/version-utils';

export { moveGenerator } from './src/generators/move/move';
export { removeGenerator } from './src/generators/remove/remove';
export { runCommandsGenerator } from './src/generators/run-commands/run-commands';
export {
  convertToNxProjectGenerator,
  convertToNxProjectSchematic,
} from './src/generators/convert-to-nx-project/convert-to-nx-project';

export const stringUtils = strings;
