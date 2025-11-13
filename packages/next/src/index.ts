export * from './src/utils/types.js';
export { createGlobPatternsOfDependentProjects } from './src/utils/generate-globs.js';

export { applicationGenerator } from './src/generators/application/application.js';
export { componentGenerator } from './src/generators/component/component.js';
export { libraryGenerator } from './src/generators/library/library.js';
export { pageGenerator } from './src/generators/page/page.js';
export { withNx } from './plugins/with-nx.js';
export { composePlugins } from './src/utils/compose-plugins.js';
