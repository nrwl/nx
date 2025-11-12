import { NxReactWebpackPlugin as _NxReactWebpackPlugin } from './plugins/nx-react-webpack-plugin/nx-react-webpack-plugin.js';

/** @deprecated Use '@nx/react/webpack-plugin' instead, which can improve graph creation by 150-200ms per file. */
export const NxReactWebpackPlugin = _NxReactWebpackPlugin;

export {
  extraEslintDependencies,
  extendReactEslintJson,
} from './src/utils/lint.js';
export { cssInJsDependenciesBabel } from './src/utils/styled.js';
export { assertValidStyle } from './src/utils/assertion.js';
export { reactDomVersion, reactVersion } from './src/utils/versions.js';
export { applicationGenerator } from './src/generators/application/application.js';
export { componentGenerator } from './src/generators/component/component.js';
export { hookGenerator } from './src/generators/hook/hook.js';
export { componentStoryGenerator } from './src/generators/component-story/component-story.js';
export { libraryGenerator } from './src/generators/library/library.js';
export { reactInitGenerator } from './src/generators/init/init.js';
export { reduxGenerator } from './src/generators/redux/redux.js';
export { storiesGenerator } from './src/generators/stories/stories.js';
export { storybookConfigurationGenerator } from './src/generators/storybook-configuration/configuration.js';
export { hostGenerator } from './src/generators/host/host.js';
export { remoteGenerator } from './src/generators/remote/remote.js';
export { cypressComponentConfigGenerator } from './src/generators/cypress-component-configuration/cypress-component-configuration.js';
export { componentTestGenerator } from './src/generators/component-test/component-test.js';
export { setupTailwindGenerator } from './src/generators/setup-tailwind/setup-tailwind.js';
export type { SupportedStyles } from './typings/style';
export * from './plugins/with-react.js';
