import { configurationGenerator } from './src/generators/configuration/configuration';
import { componentConfigurationGenerator } from './src/generators/component-configuration/component-configuration';
import { cypressProjectGenerator as _cypressProjectGenerator } from './src/generators/cypress-project/cypress-project';

export { configurationGenerator, componentConfigurationGenerator };

// Maintain backwards compatibility with the old names in case community plugins used them.
// TODO(v19): Remove old name
/** @deprecated Use `configurationGenerator` instead. It will be removed in Nx 19. */
export const cypressComponentConfiguration = componentConfigurationGenerator;

export { configurationGenerator as cypressE2EConfigurationGenerator };
// TODO(v19): Remove project generator
/** @deprecated Add a new project and call `configurationGenerator` instead. It will be removed in Nx 19. */
export const cypressProjectGenerator = _cypressProjectGenerator;
export { cypressInitGenerator } from './src/generators/init/init';
export { migrateCypressProject } from './src/generators/migrate-to-cypress-11/migrate-to-cypress-11';
