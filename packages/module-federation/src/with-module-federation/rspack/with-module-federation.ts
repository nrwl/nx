import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import type { Configuration } from '@rspack/core';
import {
  ModuleFederationConfig,
  normalizeProjectName,
  NxModuleFederationConfigOverride,
} from '../../utils';
import { getModuleFederationConfig } from './utils';
import { workspaceRoot } from '@nx/devkit';
import { isServeMode } from '../../utils/is-serve-mode';

const isVarOrWindow = (libType?: string) =>
  libType === 'var' || libType === 'window';

/**
 * @param {ModuleFederationConfig} options
 * @param {NxModuleFederationConfigOverride} configOverride
 */
export async function withModuleFederation(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return function makeConfig(config: Configuration): Configuration {
      return config;
    };
  }
  const isDevServer = isServeMode();

  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    getModuleFederationConfig(options);
  const isGlobal = isVarOrWindow(options.library?.type);
  const { DefinePlugin } =
    require('@rspack/core') as typeof import('@rspack/core');

  return function makeConfig(
    config: Configuration,
    { context }
  ): Configuration {
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';
    // rspack-cli dev mode defaults this on; it breaks module federation.
    config.lazyCompilation ??= false;

    if (isGlobal) {
      config.output.scriptType = 'text/javascript';
    }

    config.resolve ??= {};
    config.resolve.modules = [
      ...(config.resolve.modules ?? ['node_modules']),
      workspaceRoot,
    ];
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk:
        isDevServer && !options.exposes
          ? (config.optimization?.runtimeChunk ?? undefined)
          : false,
    };

    if (
      config.mode === 'development' &&
      Object.keys(mappedRemotes).length > 1 &&
      !options.exposes
    ) {
      config.optimization.runtimeChunk = 'single';
    }

    config.plugins.push(
      new ModuleFederationPlugin({
        name: normalizeProjectName(options.name),
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
        runtimePlugins:
          process.env.NX_MF_DEV_REMOTES &&
          !options.disableNxRuntimeLibraryControlPlugin
            ? [
                ...(configOverride?.runtimePlugins ?? []),
                require.resolve(
                  '@nx/module-federation/runtime-library-control-plugin'
                ),
              ]
            : configOverride?.runtimePlugins,
      }),
      sharedLibraries.getReplacementPlugin()
    );

    // The env var is only set from the module-federation-dev-server
    // Attach the runtime plugin
    config.plugins.push(
      new DefinePlugin({
        'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
      })
    );

    return config;
  };
}
