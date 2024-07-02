import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '@nx/webpack/src/utils/module-federation';
import { getModuleFederationConfig } from './utils';
import type { AsyncNxComposableWebpackPlugin } from '@nx/webpack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/webpack';

const isVarOrWindow = (libType?: string) =>
  libType === 'var' || libType === 'window';

/**
 * @param {ModuleFederationConfig} options
 * @return {Promise<AsyncNxComposableWebpackPlugin>}
 */
export async function withModuleFederation(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
): Promise<AsyncNxComposableWebpackPlugin> {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }
  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    await getModuleFederationConfig(options);
  const isGlobal = isVarOrWindow(options.library?.type);

  return (config, ctx) => {
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    if (isGlobal) {
      config.output.scriptType = 'text/javascript';
    }

    config.optimization = {
      runtimeChunk: false,
    };

    if (
      config.mode === 'development' &&
      Object.keys(mappedRemotes).length > 1 &&
      !options.exposes
    ) {
      config.optimization.runtimeChunk = 'single';
    }

    config.experiments = {
      ...config.experiments,
      outputModule: !isGlobal,
    };

    config.plugins.push(
      new ModuleFederationPlugin({
        name: options.name,
        library: options.library ?? { type: 'module' },
        filename: 'remoteEntry.js',
        exposes: options.exposes,
        remotes: mappedRemotes,
        shared: {
          ...sharedDependencies,
        },
        /**
         * remoteType: 'script' is required for the remote to be loaded as a script tag.
         * remotes will need to be defined as:
         *  { appX: 'appX@http://localhost:3001/remoteEntry.js' }
         *  { appY: 'appY@http://localhost:3002/remoteEntry.js' }
         */
        ...(isGlobal ? { remoteType: 'script' } : {}),
        /**
         * Apply user-defined config overrides
         */
        ...(configOverride ? configOverride : {}),
      }),
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
