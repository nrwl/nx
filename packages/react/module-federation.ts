import { withModuleFederation } from '@nx/module-federation/webpack';
import { withModuleFederationForSSR } from '@nx/module-federation/webpack';

/**
 * @deprecated Use `@nx/module-federation/webpack` instead. This will be removed in Nx v22.
 */
export { withModuleFederation, withModuleFederationForSSR };

// Support for older generated code: `const withModuleFederation = require('@nx/react/module-federation')`
/**
 * @deprecated Use `@nx/module-federation/webpack` instead. This will be removed in Nx v22.
 */
module.exports = withModuleFederation;

// Allow newer generated code to work: `const { withModuleFederation } = require(...)`;
/**
 * @deprecated Use `@nx/module-federation/webpack` instead. This will be removed in Nx v22.
 */
module.exports.withModuleFederation = withModuleFederation;
/**
 * @deprecated Use `@nx/module-federation/webpack` instead. This will be removed in Nx v22.
 */
module.exports.withModuleFederationForSSR = withModuleFederationForSSR;
