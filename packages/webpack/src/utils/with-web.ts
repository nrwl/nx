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

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function withWeb(
  _options: WithWebOptions = {}
): NxComposableWebpackPlugin {
  warnWebpackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
