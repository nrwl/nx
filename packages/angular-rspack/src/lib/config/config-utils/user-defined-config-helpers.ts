import type { Configuration } from '@rspack/core';
import { merge as rspackMerge } from 'webpack-merge';
import * as deepMerge from 'deepmerge';
import type { AngularRspackPluginOptions } from '../../models';

export function handleConfigurations(
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
  >,
  configurationModes: string[]
) {
  let mergedConfigurationBuildOptions = { ...defaultOptions.options };
  let mergedRspackConfigOverrides = defaultOptions.rspackConfigOverrides ?? {};
  for (const configurationName of configurationModes) {
    if (configurationName in configurations) {
      mergedConfigurationBuildOptions = deepMerge(
        mergedConfigurationBuildOptions,
        configurations[configurationName].options ?? {}
      );
      if (configurations[configurationName].rspackConfigOverrides) {
        mergedRspackConfigOverrides = rspackMerge(
          mergedRspackConfigOverrides,
          configurations[configurationName].rspackConfigOverrides
        );
      }
    }
  }
  return { mergedConfigurationBuildOptions, mergedRspackConfigOverrides };
}

export function parseConfigurationMode(configurationMode: string) {
  return configurationMode.split(',').map((m) => m.trim());
}
