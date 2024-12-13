export { configurationGenerator } from './src/generators/configuration/configuration';
export { initGenerator } from './src/generators/init/init';
export { addBuildPlugin } from './src/utils/add-build-plugin';
export {
  addCopyAssets,
  addHtmlTemplatePath,
  addExperimentalSwcPlugin,
} from './src/utils/ast-utils';
export * as versions from './src/utils/versions';
export { getRsbuildE2EWebServerInfo } from './src/utils/e2e-web-server-info-utils';
