import { workspaceRoot } from '@nx/devkit';
import { Configuration } from '@rspack/core';
import { isNxRspackComposablePlugin } from './config';
import { readNxJsonFromDisk } from 'nx/src/devkit-internals';

/**
 * Reads the Rspack options from a give Rspack configuration. The configuration can be:
 * 1. A single standard config object
 * 2. A standard function that returns a config object (standard Rspack)
 * 3. An array of standard config objects (multi-configuration mode)
 * 4. A Nx-specific composable function that takes Nx context, rspack config, and returns the config object.
 *
 * @param rspackConfig
 */
export async function readRspackOptions(
  rspackConfig: unknown
): Promise<Configuration[]> {
  const configs: Configuration[] = [];

  const resolveConfig = async (
    config: unknown
  ): Promise<Configuration | Configuration[]> => {
    let resolvedConfig: Configuration;
    if (isNxRspackComposablePlugin(config)) {
      resolvedConfig = await config(
        {},
        {
          // These values are only used during build-time, so passing stubs here just to read out
          // the returned config object.
          options: {
            root: workspaceRoot,
            projectRoot: '',
            sourceRoot: '',
            outputFileName: '',
            assets: [],
            main: '',
            tsConfig: '',
            outputPath: '',
            rspackConfig: '',
            useTsconfigPaths: undefined,
          },
          context: {
            root: workspaceRoot,
            cwd: undefined,
            isVerbose: false,
            nxJsonConfiguration: readNxJsonFromDisk(workspaceRoot),
            projectGraph: null,
            projectsConfigurations: null,
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

  if (Array.isArray(rspackConfig)) {
    for (const config of rspackConfig) {
      const resolved = await resolveConfig(config);
      configs.push(...flattenConfigs(resolved));
    }
  } else {
    const resolved = await resolveConfig(rspackConfig);
    configs.push(...flattenConfigs(resolved));
  }

  return configs;
}
