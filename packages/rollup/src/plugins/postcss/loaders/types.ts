import type { RawSourceMap } from 'source-map-js';
import type { PostCSSModulesOptions } from '../options';
import type { AcceptedPlugin } from 'postcss';

/**
 * Context passed to each loader during processing
 */
export interface LoaderContext {
  /** Absolute path to the file being processed */
  id: string;
  /** Whether source maps are enabled */
  sourceMap: boolean | 'inline';
  /** Set of file dependencies (for watch mode) */
  dependencies: Set<string>;
  /** Function to emit warnings */
  warn: (message: string) => void;
}

/**
 * Result returned from a loader
 */
export interface LoaderResult {
  /** Processed CSS/code */
  code: string;
  /** Source map (if generated) */
  map?: RawSourceMap;
  /** Extracted CSS content (for extraction mode) */
  extracted?: {
    /** CSS content */
    code: string;
    /** CSS source map */
    map?: RawSourceMap;
  };
  /** CSS module exports (class name mappings) */
  exports?: Record<string, string>;
}

/**
 * Interface for CSS loaders (preprocessors and PostCSS)
 */
export interface Loader {
  /** Unique name for this loader */
  name: string;
  /** Test to determine if this loader should process a file */
  test: RegExp | ((filepath: string) => boolean);
  /** Whether this loader should always process files (like postcss-loader) */
  alwaysProcess?: boolean;
  /** Process the file and return the result */
  process(
    code: string,
    context: LoaderContext,
    options?: Record<string, unknown>
  ): Promise<LoaderResult>;
}

/**
 * Options for the PostCSS loader
 */
export interface PostCSSLoaderOptions {
  /** PostCSS plugins to apply */
  plugins: AcceptedPlugin[];
  /** CSS modules options */
  modules: boolean | PostCSSModulesOptions;
  /** Auto-detect CSS modules from .module.xxx files */
  autoModules: boolean;
  /** Extract CSS to separate file instead of injecting */
  extract: boolean | string;
  /** Inject CSS into DOM */
  inject:
    | boolean
    | Record<string, unknown>
    | ((cssVar: string, id: string) => string);
}

/**
 * Options for the Less loader
 */
export interface LessLoaderOptions {
  /** Enable inline JavaScript in Less files */
  javascriptEnabled?: boolean;
  /** Additional Less options */
  [key: string]: unknown;
}

/**
 * Options for the Sass loader
 */
export interface SassLoaderOptions {
  /** Sass implementation to use */
  implementation?: string;
  /** Additional Sass options */
  [key: string]: unknown;
}

/**
 * Options for the Stylus loader
 */
export interface StylusLoaderOptions {
  /** Additional Stylus options */
  [key: string]: unknown;
}
