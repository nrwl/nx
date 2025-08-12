import { DeprecationOrId } from 'sass-embedded';

export interface StylePreprocessorOptions {
  /**
   * Paths to include. Paths will be resolved to workspace root.
   */
  includePaths?: string[];
  /**
   * Options to pass to the sass preprocessor.
   */
  sass?: Sass;
}

/**
 * Options to pass to the sass preprocessor.
 */
export interface Sass {
  /**
   * A set of deprecations to treat as fatal. If a deprecation warning of any provided type is
   * encountered during compilation, the compiler will error instead. If a Version is
   * provided, then all deprecations that were active in that compiler version will be treated
   * as fatal.
   */
  fatalDeprecations?: DeprecationOrId[];
  /**
   * A set of future deprecations to opt into early. Future deprecations passed here will be
   * treated as active by the compiler, emitting warnings as necessary.
   */
  futureDeprecations?: DeprecationOrId[];
  /**
   * A set of active deprecations to ignore. If a deprecation warning of any provided type is
   * encountered during compilation, the compiler will ignore it instead.
   */
  silenceDeprecations?: DeprecationOrId[];
}
