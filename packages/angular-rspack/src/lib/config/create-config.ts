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
import { getSwcTranspilationTransform } from './config-utils/swc-transpilation';
import {
  handleConfigurations,
  parseConfigurationMode,
} from './config-utils/user-defined-config-helpers';
import { assertSupportedRspackCoreVersion } from '../utils/assert-supported-rspack-version';
import { isServeMode } from '../utils/rspack-serve-env';
import type { SharedLicenseInputs } from '../plugins/extract-licenses-plugin';

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
    process.env[configEnvVar] ?? (isServeMode() ? 'development' : 'production');
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
  assertSupportedRspackCoreVersion();

  const { i18n, i18nHash, normalizedOptions } =
    await normalizeOptionWithI18n(options);
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

  // Overrides may point module resolution at a different tsconfig; derive
  // the swc rule semantics from the one the bundler will actually use.
  const overrideTsConfig = rspackConfigOverrides?.resolve?.tsConfig;
  const swcTranspilationTransform = getSwcTranspilationTransform(
    typeof overrideTsConfig === 'string'
      ? overrideTsConfig
      : (overrideTsConfig?.configFile ?? normalizedOptions.tsConfig)
  );

  // The browser and server compilers write the licenses file to the same
  // location; sharing the collected inputs makes each emit the union.
  const sharedLicenseInputs: SharedLicenseInputs | undefined =
    normalizedOptions.hasServer ? new Map() : undefined;

  const configs: Configuration[] = [];
  if (normalizedOptions.hasServer) {
    const serverConfig: Configuration = await getServerConfig(
      normalizedOptions,
      i18n,
      defaultConfig,
      swcTranspilationTransform,
      sharedLicenseInputs
    );
    const mergedConfig = rspackMerge(serverConfig, rspackConfigOverrides ?? {});
    configs.push(mergedConfig);
  }

  const browserConfig: Configuration = await getBrowserConfig(
    normalizedOptions,
    i18n,
    hashFormat,
    defaultConfig,
    swcTranspilationTransform,
    sharedLicenseInputs
  );
  const mergedConfig = rspackMerge(browserConfig, rspackConfigOverrides ?? {});
  configs.unshift(mergedConfig);
  return configs;
}
