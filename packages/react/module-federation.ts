import { withModuleFederation } from './src/module-federation/with-module-federation';

export { withModuleFederation };

// Support for older generated code: `const withModuleFederation = require('@nrwl/react/module-federation')`
module.exports = withModuleFederation;
// Allow newer generated code to work: `const { withModuleFederation } = require(...)`;
module.exports.withModuleFederation = withModuleFederation;
