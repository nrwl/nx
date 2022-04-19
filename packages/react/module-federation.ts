import { withModuleFederation } from './src/module-federation/with-module-federation';

export * from './src/module-federation/webpack-utils';
export * from './src/module-federation/with-module-federation';
export { withModuleFederation as default };

module.exports = withModuleFederation;
