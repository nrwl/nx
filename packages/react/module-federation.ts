import { withModuleFederation } from './src/module-federation/with-module-federation';
export * from './src/module-federation/models';
export * from './src/module-federation/webpack-utils';
export { withModuleFederation };

// Support for older generated code: `const withModuleFederation = require('@nrwl/react/module-federation')`
module.exports = withModuleFederation;
// Allow newer generated code to work: `const { withModuleFederation } = require(...)`;
module.exports.withModuleFederation = withModuleFederation;
