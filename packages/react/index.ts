import { NxReactWebpackPlugin as _NxReactWebpackPlugin } from './plugins/nx-react-webpack-plugin/nx-react-webpack-plugin';

// TODO(v21): Remove this in favor of deep imports in order to load configs faster (150-200ms faster).
/** @deprecated Use '@nx/react/webpack-plugin' instead. */
export const NxReactWebpackPlugin = _NxReactWebpackPlugin;

export {
  extraEslintDependencies,
  extendReactEslintJson,
} from './src/utils/lint';
export { cssInJsDependenciesBabel } from './src/utils/styled';
export { assertValidStyle } from './src/utils/assertion';
export { reactDomVersion, reactVersion } from './src/utils/versions';
export { applicationGenerator } from './src/generators/application/application';
export { componentGenerator } from './src/generators/component/component';
export { hookGenerator } from './src/generators/hook/hook';
export { componentStoryGenerator } from './src/generators/component-story/component-story';
export { libraryGenerator } from './src/generators/library/library';
export { reactInitGenerator } from './src/generators/init/init';
export { reduxGenerator } from './src/generators/redux/redux';
export { storiesGenerator } from './src/generators/stories/stories';
export { storybookConfigurationGenerator } from './src/generators/storybook-configuration/configuration';
export { hostGenerator } from './src/generators/host/host';
export { remoteGenerator } from './src/generators/remote/remote';
export { cypressComponentConfigGenerator } from './src/generators/cypress-component-configuration/cypress-component-configuration';
export { componentTestGenerator } from './src/generators/component-test/component-test';
export { setupTailwindGenerator } from './src/generators/setup-tailwind/setup-tailwind';
export type { SupportedStyles } from './typings/style';
export * from './plugins/with-react';
