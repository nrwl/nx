import { configurationGenerator } from './generators/configuration/configuration.js';

export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
const esbuildProjectGenerator = configurationGenerator;

export * from './generators/init/init.js';
export * from './utils/versions.js';
