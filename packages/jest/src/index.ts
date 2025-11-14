import { configurationGenerator } from './generators/configuration/configuration.js';

export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/**
 * @deprecated Use `configurationGenerator` instead. It will be removed in Nx v22.
 */
export const jestProjectGenerator = configurationGenerator;

export {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from './utils/config/update-config.js';
export { jestConfigObjectAst } from './utils/config/functions.js';
export { jestInitGenerator } from './generators/init/init.js';
export { getJestProjectsAsync } from './utils/config/get-jest-projects.js';
export { findJestConfig } from './utils/config/config-file.js';
