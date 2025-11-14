export { readTsConfig } from './utilities/ts-config.js';
export { ProjectType, projectRootDir } from './utils/project-type.js';
export {
  renameSync,
  updateJsonFile,
  copyFile,
  createDirectory,
} from './utilities/fileutils.js';

export { names } from '@nx/devkit';

export { output } from './utilities/output.js';

export { readPackageJson } from 'nx/src/project-graph/file-utils';

export {
  getWorkspacePath,
  editTarget,
  parseTarget,
  serializeTarget,
} from './utils/cli-config-utils.js';

export { Linter } from './utils/lint.js';

export { moveGenerator } from './generators/move/move.js';
export { removeGenerator } from './generators/remove/remove.js';
export { runCommandsGenerator } from './generators/run-commands/run-commands.js';
export { convertToNxProjectGenerator } from './generators/convert-to-nx-project/convert-to-nx-project.js';
