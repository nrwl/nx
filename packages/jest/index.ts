import { configurationGenerator } from './src/generators/configuration/configuration';
export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
export const jestProjectGenerator = configurationGenerator;

export {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from './src/utils/config/update-config';
export { jestConfigObjectAst } from './src/utils/config/functions';
export { jestInitGenerator } from './src/generators/init/init';
export {
  getJestProjects,
  getJestProjectsAsync,
  getNestedJestProjects,
} from './src/utils/config/get-jest-projects';
