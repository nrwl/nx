import type { AcceptedPlugin } from 'postcss';

export type FilterPattern = string | RegExp | (string | RegExp)[];

export interface PostCSSModulesOptions {
  /** Generate scoped names */
  generateScopedName?:
    | string
    | ((name: string, filename: string, css: string) => string);
  /** Scope behaviour */
  scopeBehaviour?: 'global' | 'local';
  /** Global module paths */
  globalModulePaths?: RegExp[];
  /** Export globals */
  exportGlobals?: boolean;
  /** Hash prefix */
  hashPrefix?: string;
  /** Locate imports */
  localsConvention?: 'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly';
}

export interface LessOptions {
  /** Enable inline JavaScript in Less files */
  javascriptEnabled?: boolean;
  /** Additional Less options */
  [key: string]: unknown;
}

export interface SassOptions {
  /** Sass implementation to use ('sass' or 'node-sass') */
  implementation?: string;
  /** Additional Sass options */
  [key: string]: unknown;
}

export interface StylusOptions {
  /** Additional Stylus options */
  [key: string]: unknown;
}

export interface UseOptions {
  sass?: SassOptions | false;
  less?: LessOptions | false;
  stylus?: StylusOptions | false;
}

export interface PostCSSPluginOptions {
  /**
   * Inject CSS as <style> tag to <head>
   * @default true
   */
  inject?:
    | boolean
    | Record<string, unknown>
    | ((cssVar: string, id: string) => string);

  /**
   * Extract CSS to a separate file
   * - `true`: Extract to `[name].css`
   * - `string`: Extract to the specified path
   * @default false
   */
  extract?: boolean | string;

  /**
   * Automatically enable CSS modules for `.module.xxx` files
   * @default false
   */
  autoModules?: boolean;

  /**
   * Enable CSS modules
   * - `true`: Enable with default options
   * - `object`: Enable with custom options
   * @default false
   */
  modules?: boolean | PostCSSModulesOptions;

  /**
   * PostCSS plugins to apply
   */
  plugins?: AcceptedPlugin[];

  /**
   * Preprocessor options
   */
  use?: UseOptions;

  /**
   * Files to include
   * @default [/\.css$/, /\.sss$/, /\.pcss$/]
   */
  include?: FilterPattern;

  /**
   * Files to exclude
   * @default /node_modules/
   */
  exclude?: FilterPattern;

  /**
   * Generate source maps
   * - `true`: Generate external source maps
   * - `'inline'`: Generate inline source maps
   * @default false
   */
  sourceMap?: boolean | 'inline';

  /**
   * File extensions to process
   * @default ['.css', '.sss', '.pcss']
   */
  extensions?: string[];
}

/**
 * Internal options after normalization
 */
export interface NormalizedPostCSSOptions extends PostCSSPluginOptions {
  inject:
    | boolean
    | Record<string, unknown>
    | ((cssVar: string, id: string) => string);
  extract: boolean | string;
  autoModules: boolean;
  modules: boolean | PostCSSModulesOptions;
  plugins: AcceptedPlugin[];
  use: UseOptions;
  extensions: string[];
  sourceMap: boolean | 'inline';
}

/**
 * Normalize plugin options with defaults
 */
export function normalizeOptions(
  options: PostCSSPluginOptions = {}
): NormalizedPostCSSOptions {
  return {
    ...options,
    inject: options.inject ?? true,
    extract: options.extract ?? false,
    autoModules: options.autoModules ?? false,
    modules: options.modules ?? false,
    plugins: options.plugins ?? [],
    use: options.use ?? {},
    extensions: options.extensions ?? ['.css', '.sss', '.pcss'],
    sourceMap: options.sourceMap ?? false,
  };
}
