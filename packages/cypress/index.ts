import { configurationGenerator } from './src/generators/configuration/configuration';
import { componentConfigurationGenerator } from './src/generators/component-configuration/component-configuration';
export { configurationGenerator, componentConfigurationGenerator };

// Maintain backwards compatibility with the old names in case community plugins used them.
/** @deprecated Use `configurationGenerator` instead. */
export const cypressComponentConfiguration = componentConfigurationGenerator;

export { configurationGenerator as cypressE2EConfigurationGenerator };
export { cypressProjectGenerator } from './src/generators/cypress-project/cypress-project';
export { cypressInitGenerator } from './src/generators/init/init';
export { conversionGenerator } from './src/generators/convert-tslint-to-eslint/convert-tslint-to-eslint';
export { migrateCypressProject } from './src/generators/migrate-to-cypress-11/migrate-to-cypress-11';
