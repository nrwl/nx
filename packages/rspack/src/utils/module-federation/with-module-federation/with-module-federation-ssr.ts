import { DefinePlugin } from '@rspack/core';
import { SharedConfigContext } from '../../model';
import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '../models';
import { getModuleFederationConfig } from './utils';

export async function withModuleFederationForSSR(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }

  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, {
      isServer: true,
    });

  return (config, { context }: SharedConfigContext) => {
    config.target = 'async-node';
    config.output.uniqueName = options.name;
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    };

    config.plugins.push(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      new (require('@module-federation/enhanced/rspack').ModuleFederationPlugin)(
        {
          name: options.name.replace(/-/g, '_'),
          filename: 'remoteEntry.js',
          exposes: options.exposes,
          remotes: mappedRemotes,
          shared: {
            ...sharedDependencies,
          },
          isServer: true,
          /**
           * Apply user-defined config overrides
           */
          ...(configOverride ? configOverride : {}),
          runtimePlugins:
            process.env.NX_MF_DEV_REMOTES &&
            !options.disableNxRuntimeLibraryControlPlugin
              ? [
                  ...(configOverride?.runtimePlugins ?? []),
                  require.resolve('@module-federation/node/runtimePlugin'),
                  require.resolve(
                    '@nx/rspack/src/utils/module-federation/plugins/runtime-library-control.plugin.js'
                  ),
                ]
              : [
                  ...(configOverride?.runtimePlugins ?? []),
                  require.resolve('@module-federation/node/runtimePlugin'),
                ],
          virtualRuntimeEntry: true,
        },
        {}
      ),
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
