import { workspaceRoot } from '@nx/devkit';
import { isNxWebpackComposablePlugin } from '../config';
import { Configuration } from 'webpack';
import { readNxJsonFromDisk } from 'nx/src/devkit-internals';

/**
 * Reads the webpack options from a give webpack configuration. The configuration can be:
 * 1. A standard config object
 * 2. A standard function that returns a config object (webpack.js.org/configuration/configuration-types/#exporting-a-function)
 * 3. An array of standard config objects (multi-configuration mode)
 * 4. A Nx-specific composable function that takes Nx context, webpack config, and returns the config object.
 *
 * @param webpackConfig
 */
export async function readWebpackOptions(
  webpackConfig: unknown
): Promise<Configuration[]> {
  const configs: Configuration[] = [];

  const resolveConfig = async (
    config: unknown
  ): Promise<Configuration | Configuration[]> => {
    if (isNxWebpackComposablePlugin(config)) {
      return await config(
        {},
        {
          // These values are only used during build-time, so passing stubs here just to read out
          options: {
            root: workspaceRoot,
            projectRoot: '',
            sourceRoot: '',
            outputFileName: undefined,
            outputPath: undefined,
            assets: undefined,
            useTsconfigPaths: undefined,
          },
          context: {
            root: workspaceRoot,
            cwd: undefined,
            isVerbose: false,
            projectsConfigurations: null,
            projectGraph: null,
            nxJsonConfiguration: readNxJsonFromDisk(workspaceRoot),
          },
        }
      );
    } else if (typeof config === 'function') {
      const resolved = await config(
        {
          production: true, // we want the production build options
        },
        {}
      );

      // If the resolved configuration is an array, resolve each configuration
      return Array.isArray(resolved)
        ? (await Promise.all(resolved.map(resolveConfig))).flat()
        : resolved;
    } else if (Array.isArray(config)) {
      // If the config passed is an array, resolve each configuration
      const resolvedConfigs = await Promise.all(config.map(resolveConfig));
      return resolvedConfigs.flat();
    } else {
      // Return plain configuration
      return config as Configuration;
    }
  };

  // Since configs can have nested arrays, we need to flatten them
  const flattenConfigs = (
    resolvedConfigs: Configuration | Configuration[]
  ): Configuration[] => {
    return Array.isArray(resolvedConfigs)
      ? resolvedConfigs.flatMap((cfg) => flattenConfigs(cfg))
      : [resolvedConfigs];
  };

  if (Array.isArray(webpackConfig)) {
    for (const config of webpackConfig) {
      const resolved = await resolveConfig(config);
      configs.push(...flattenConfigs(resolved));
    }
  } else {
    const resolved = await resolveConfig(webpackConfig);
    configs.push(...flattenConfigs(resolved));
  }

  return configs;
}
