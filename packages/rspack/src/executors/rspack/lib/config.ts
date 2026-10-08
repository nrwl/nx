import { ExecutorContext } from '@nx/devkit';
import { type Configuration } from '@rspack/core';
import { isNxRspackComposablePlugin } from '../../../utils/config';
import { resolveUserDefinedRspackConfig } from '../../../utils/resolve-user-defined-rspack-config';
import { applyBaseConfig } from '../../../plugins/utils/apply-base-config';
import { applyWebConfig } from '../../../plugins/utils/apply-web-config';
import { type NormalizedRspackExecutorSchema } from '../schema';

export async function getRspackConfigs(
  options: NormalizedRspackExecutorSchema & { devServer?: any },
  context: ExecutorContext
): Promise<Configuration | Configuration[]> {
  let maybeUserDefinedConfig = await resolveUserDefinedRspackConfig(
    options.rspackConfig,
    options.tsConfig
  );
  let userDefinedConfig =
    'default' in maybeUserDefinedConfig
      ? 'default' in maybeUserDefinedConfig.default
        ? maybeUserDefinedConfig.default.default
        : maybeUserDefinedConfig.default
      : maybeUserDefinedConfig;

  if (typeof userDefinedConfig.then === 'function') {
    userDefinedConfig = await userDefinedConfig;
  }

  const config: Configuration = {};
  const configOptions = {
    ...options,
    target: options.target ?? 'web',
    assets: options.assets ?? [],
    root: context.root,
    projectName: context.projectName,
    targetName: context.targetName,
    configurationName: context.configurationName,
    projectGraph: context.projectGraph,
    useLegacyHtmlPlugin: false,
  };
  applyBaseConfig(configOptions, config);
  if (options.target === 'web') {
    applyWebConfig(configOptions, config);
  }

  if (
    typeof userDefinedConfig === 'function' &&
    (isNxRspackComposablePlugin(userDefinedConfig) ||
      !options.standardRspackConfigFunction)
  ) {
    // Old behavior, call the Nx-specific rspack config function that user exports
    return await userDefinedConfig(config, {
      options,
      context,
      configuration: context.configurationName,
    });
  } else if (userDefinedConfig) {
    if (typeof userDefinedConfig === 'function') {
      // assume it's an async standard rspack config function which operates similar to webpack
      // https://webpack.js.org/configuration/configuration-types/#exporting-a-promise
      return await userDefinedConfig(process.env.NODE_ENV, {});
    }
    // New behavior, we want the rspack config to export object
    return userDefinedConfig;
  } else {
    // Fallback case, if we cannot find a rspack config path
    return config;
  }
}
