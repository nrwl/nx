import { workspaceRoot } from '@nx/devkit';
import { Configuration } from '@rspack/core';
import { isNxRspackComposablePlugin } from './config';
import { readNxJsonFromDisk } from 'nx/src/devkit-internals';

/**
 * Reads the Rspack options from a give Rspack configuration. The configuration can be:
 * 1. A standard config object
 * 2. A standard function that returns a config object
 * 3. A Nx-specific composable function that takes Nx context, rspack config, and returns the config object.
 *
 * @param rspackConfig
 */
export async function readRspackOptions(
  rspackConfig: unknown
): Promise<Configuration> {
  let config: Configuration;
  if (isNxRspackComposablePlugin(rspackConfig)) {
    config = await rspackConfig(
      {},
      {
        // These values are only used during build-time, so passing stubs here just to read out
        // the returned config object.
        options: {
          root: workspaceRoot,
          projectRoot: '',
          sourceRoot: '',
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
  } else if (typeof rspackConfig === 'function') {
    config = await rspackConfig(
      {
        production: true, // we want the production build options
      },
      {}
    );
  } else {
    config = rspackConfig;
  }
  return config;
}
