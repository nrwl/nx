import { configurationGenerator } from './src/generators/configuration/configuration.js';
export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/**
 * @deprecated Use `configurationGenerator` instead. It will be removed in Nx v22.
 */
export const jestProjectGenerator = configurationGenerator;

export {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from './src/utils/config/update-config.js';
export { jestConfigObjectAst } from './src/utils/config/functions.js';
export { jestInitGenerator } from './src/generators/init/init.js';
export { getJestProjectsAsync } from './src/utils/config/get-jest-projects.js';
export { findJestConfig } from './src/utils/config/config-file.js';
