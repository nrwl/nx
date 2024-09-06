import {composePlugins, withNx, withReact} from '@nx/rspack';
import {withModuleFederation} from '@nx/rspack/module-federation';

import baseConfig from './module-federation.config';

const config = {
    ...baseConfig,
};

// Nx plugins for rspack to build config object from Nx options and context.
/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default composePlugins(withNx(), withReact(), withModuleFederation(config, { dts: false }));
