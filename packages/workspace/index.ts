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

export {
  getWorkspacePath,
  editTarget,
  parseTarget,
  serializeTarget,
} from './src/utils/cli-config-utils';

export { Linter } from './src/utils/lint';

export { moveGenerator } from './src/generators/move/move';
export { removeGenerator } from './src/generators/remove/remove';
export { runCommandsGenerator } from './src/generators/run-commands/run-commands';
export { convertToNxProjectGenerator } from './src/generators/convert-to-nx-project/convert-to-nx-project';
