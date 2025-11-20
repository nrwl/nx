import { type Configuration } from '@rspack/core';
import { merge as rspackMerge } from 'webpack-merge';
import { type AngularRspackPluginOptions } from '../models';
import {
  deleteOutputDir,
  getOutputHashFormat,
  normalizeOptionWithI18n,
} from './config-utils/helpers';
import { getCommonConfig } from './config-utils/common-config';
import { getServerConfig } from './config-utils/server-config';
import { getBrowserConfig } from './config-utils/browser-config';
import {
  handleConfigurations,
  parseConfigurationMode,
} from './config-utils/user-defined-config-helpers';

export async function createConfig(
  defaultOptions: {
    options: AngularRspackPluginOptions;
    rspackConfigOverrides?: Partial<Configuration>;
  },
  configurations: Record<
    string,
    {
      options: Partial<AngularRspackPluginOptions>;
      rspackConfigOverrides?: Partial<Configuration>;
    }
  > = {},
  configEnvVar = 'NGRS_CONFIG'
): Promise<Configuration[]> {
  const configurationMode =
    process.env[configEnvVar] ??
    (process.env['WEBPACK_SERVE'] ? 'development' : 'production');
  const configurationModes = parseConfigurationMode(configurationMode);

  const { mergedConfigurationBuildOptions, mergedRspackConfigOverrides } =
    handleConfigurations(defaultOptions, configurations, configurationModes);

  return _createConfig(
    mergedConfigurationBuildOptions,
    mergedRspackConfigOverrides
  );
}

export async function _createConfig(
  options: AngularRspackPluginOptions,
  rspackConfigOverrides?: Partial<Configuration>
): Promise<Configuration[]> {
  const { i18n, i18nHash, normalizedOptions } = await normalizeOptionWithI18n(
    options
  );
  const hashFormat = getOutputHashFormat(normalizedOptions.outputHashing);

  if (normalizedOptions.deleteOutputPath) {
    await deleteOutputDir(
      normalizedOptions.root,
      normalizedOptions.outputPath.base
    );
  }

  const defaultConfig = await getCommonConfig(
    normalizedOptions,
    i18n,
    i18nHash,
    hashFormat
  );

  const configs: Configuration[] = [];
  if (normalizedOptions.hasServer) {
    const serverConfig: Configuration = await getServerConfig(
      normalizedOptions,
      i18n,
      defaultConfig
    );
    const mergedConfig = rspackMerge(serverConfig, rspackConfigOverrides ?? {});
    configs.push(mergedConfig);
  }

  const browserConfig: Configuration = await getBrowserConfig(
    normalizedOptions,
    i18n,
    hashFormat,
    defaultConfig
  );
  const mergedConfig = rspackMerge(browserConfig, rspackConfigOverrides ?? {});
  configs.unshift(mergedConfig);
  return configs;
}
