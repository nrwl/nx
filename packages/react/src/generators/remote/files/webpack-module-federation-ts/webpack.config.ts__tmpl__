import {composePlugins, withNx} from '@nx/webpack';
import {withReact} from '@nx/react';
import {withModuleFederation} from '@nx/module-federation/webpack.js';

import baseConfig from './module-federation.config';

const config = {
  ...baseConfig,
};

// Nx plugins for webpack to build config object from Nx options and context.
/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default composePlugins(withNx(), withReact(), withModuleFederation(config, { dts: false }));
