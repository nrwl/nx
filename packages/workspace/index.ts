export { readTsConfig } from './src/utilities/ts-config.js';
export { ProjectType, projectRootDir } from './src/utils/project-type.js';
export {
  renameSync,
  updateJsonFile,
  copyFile,
  createDirectory,
} from './src/utilities/fileutils.js';

export { names } from '@nx/devkit';

export { output } from './src/utilities/output.js';

export { readPackageJson } from 'nx/src/project-graph/file-utils';

export {
  getWorkspacePath,
  editTarget,
  parseTarget,
  serializeTarget,
} from './src/utils/cli-config-utils.js';

export { Linter } from './src/utils/lint.js';

export { moveGenerator } from './src/generators/move/move.js';
export { removeGenerator } from './src/generators/remove/remove.js';
export { runCommandsGenerator } from './src/generators/run-commands/run-commands.js';
export { convertToNxProjectGenerator } from './src/generators/convert-to-nx-project/convert-to-nx-project.js';
