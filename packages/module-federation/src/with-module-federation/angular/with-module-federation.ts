import {
  normalizeProjectName,
  type ModuleFederationConfig,
  type NxModuleFederationConfigOverride,
} from '../../utils';
import { getModuleFederationConfig } from './utils';
import { ModuleFederationPlugin } from '@module-federation/enhanced/webpack';

export async function withModuleFederation(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }
  // This is required to ensure that the webpack version used by the Angular CLI is used
  process.env['FEDERATION_WEBPACK_PATH'] = require.resolve('webpack', {
    paths: [require.resolve('@angular-devkit/build-angular')],
  });
  const isDevServer = process.env['WEBPACK_SERVE'];

  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, undefined, 'webpack');

  return (config) => {
    const updatedConfig = {
      ...(config ?? {}),
      output: {
        ...(config.output ?? {}),
        uniqueName: options.name,
        publicPath: 'auto',
      },
      optimization: {
        ...(config.optimization ?? {}),
        runtimeChunk:
          isDevServer && !options.exposes
            ? config.optimization?.runtimeChunk ?? undefined
            : false,
      },
      resolve: {
        ...(config.resolve ?? {}),
        alias: {
          ...(config.resolve?.alias ?? {}),
          ...sharedLibraries.getAliases(),
        },
      },
      experiments: {
        ...(config.experiments ?? {}),
        outputModule: true,
      },
      plugins: [
        ...(config.plugins ?? []),
        new ModuleFederationPlugin({
          name: normalizeProjectName(options.name),
          filename: 'remoteEntry.mjs',
          exposes: options.exposes,
          remotes: mappedRemotes,
          shared: {
            ...sharedDependencies,
          },
          library: {
            type: 'module',
          },
          /**
           * Apply user-defined config override
           */
          ...(configOverride ? configOverride : {}),
          experiments: {
            asyncStartup: true,
            // We should allow users to override experiments
            ...(configOverride?.experiments ?? {}),
          },
          runtimePlugins:
            process.env.NX_MF_DEV_REMOTES &&
            !options.disableNxRuntimeLibraryControlPlugin
              ? [
                  ...(configOverride?.runtimePlugins ?? []),
                  require.resolve(
                    '@nx/module-federation/src/utils/plugins/runtime-library-control.plugin.js'
                  ),
                ]
              : configOverride?.runtimePlugins,
        }),
        sharedLibraries.getReplacementPlugin(),
      ],
    };

    // The env var is only set from the module-federation-dev-server
    // Attach the runtime plugin
    updatedConfig.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
      })
    );

    return updatedConfig;
  };
}
