import type { Configuration } from 'webpack';
import type { NxComposableWebpackPlugin } from './config';
import { warnWebpackComposeHelpersDeprecation } from './deprecation';
import type {
  ExtraEntryPointClass,
  NormalizedWebpackExecutorOptions,
} from '../executors/webpack/schema';

export interface WithWebOptions {
  baseHref?: string;
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
  deployUrl?: string;
  extractCss?: boolean;
  generateIndexHtml?: boolean;
  index?: string;
  postcssConfig?: string;
  scripts?: Array<ExtraEntryPointClass | string>;
  stylePreprocessorOptions?: {
    includePaths?: string[];
    sassOptions?: Record<string, any>;
    lessOptions?: Record<string, any>;
  };
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

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use `NxAppWebpackPlugin` from `@nx/webpack/app-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function withWeb(
  _options: WithWebOptions = {}
): NxComposableWebpackPlugin {
  warnWebpackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
