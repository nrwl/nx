import type { Configuration } from '@rspack/core';
import type { NxComposableRspackPlugin } from './config';
import { warnRspackComposeHelpersDeprecation } from './deprecation';
import type { ExtraEntryPointClass } from './model';

export interface WithWebOptions {
  baseHref?: string;
  deployUrl?: string;
  extractCss?: boolean;
  generateIndexHtml?: boolean;
  index?: string;
  postcssConfig?: string;
  scripts?: Array<ExtraEntryPointClass | string>;
  styles?: Array<ExtraEntryPointClass | string>;
  stylePreprocessorOptions?: {
    includePaths?: string[];
    sassOptions?: Record<string, any>;
    lessOptions?: Record<string, any>;
  };
  cssModules?: boolean;
  ssr?: boolean;
  /**
   * Use the legacy WriteIndexHtmlPlugin instead of the built-in HtmlRspackPlugin.
   */
  useLegacyHtmlPlugin?: boolean;
  /**
   * Requires useLegacyHtmlPlugin to be false.
   * Allows to overwrite the parameters used in the template. When using a function, pass in the original template parameters and use the returned object as the final template parameters.
   */
  templateParameters?:
    | Record<string, string>
    | boolean
    | ((
        params: Record<string, any>
      ) => Record<string, any> | Promise<Record<string, any>>);
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function withWeb(
  _options: WithWebOptions = {}
): NxComposableRspackPlugin {
  warnRspackComposeHelpersDeprecation();
  return (config: Configuration) => config;
}
