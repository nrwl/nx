import { withModuleFederation } from './src/module-federation/with-module-federation';
import { withModuleFederationForSSR } from './src/module-federation/with-module-federation-ssr';

export { withModuleFederation };
export { withModuleFederationForSSR };

// Support for older generated code: `const withModuleFederation = require('@nx/react/module-federation')`
module.exports = withModuleFederation;

// Allow newer generated code to work: `const { withModuleFederation } = require(...)`;
module.exports.withModuleFederation = withModuleFederation;
module.exports.withModuleFederationForSSR = withModuleFederationForSSR;
