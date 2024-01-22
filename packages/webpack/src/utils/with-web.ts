import { Configuration } from 'webpack';

import { NxComposableWebpackPlugin, NxWebpackExecutionContext } from './config';
import {
  ExtraEntryPointClass,
  NormalizedWebpackExecutorOptions,
} from '../executors/webpack/schema';
import { applyWebConfig } from '../plugins/nx-webpack-plugin/lib/apply-web-config';

const processed = new Set();

export interface WithWebOptions {
  baseHref?: string;
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  deployUrl?: string;
  extractCss?: boolean;
  generateIndexHtml?: boolean;
  index?: string;
  postcssConfig?: string;
  scripts?: Array<ExtraEntryPointClass | string>;
  stylePreprocessorOptions?: any;
  styles?: Array<ExtraEntryPointClass | string>;
  subresourceIntegrity?: boolean;
  ssr?: boolean;
}

// Omit deprecated options
export type MergedOptions = Omit<
  NormalizedWebpackExecutorOptions,
  keyof WithWebOptions
> &
  WithWebOptions;

/**
 * @param {WithWebOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withWeb(
  pluginOptions: WithWebOptions = {}
): NxComposableWebpackPlugin {
  return function configure(
    config: Configuration,
    { options, context }: NxWebpackExecutionContext
  ): Configuration {
    if (processed.has(config)) return config;

    applyWebConfig(
      {
        ...options,
        ...pluginOptions,
        projectName: context.projectName,
        targetName: context.targetName,
        configurationName: context.configurationName,
        projectGraph: context.projectGraph,
      },
      config
    );

    processed.add(config);
    return config;
  };
}
