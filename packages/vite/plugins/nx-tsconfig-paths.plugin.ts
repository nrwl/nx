import type { Plugin } from 'vite';
import { warnNxViteTsPathsDeprecation } from '../src/utils/deprecation';

export interface nxViteTsPathsOptions {
  /**
   * Enable debug logging
   * If set to false, it will always ignore the debug logging even when `--verbose` or `NX_VERBOSE_LOGGING` is set to true.
   * @default undefined
   **/
  debug?: boolean;
  /**
   * export fields in package.json to use for resolving
   * @default [['exports', '.', 'import'], 'module', 'main']
   *
   * fallback resolution will use ['main', 'module']
   **/
  mainFields?: (string | string[])[];
  /**
   * extensions to check when resolving files when package.json resolution fails
   * @default ['.ts', '.tsx', '.js', '.jsx', '.json', '.mts', '.mjs', '.cts', '.cjs', '.css', '.scss', '.less']
   **/
  extensions?: string[];
  /**
   * Inform Nx whether to use the raw source or to use the built output for buildable dependencies.
   * Set to `false` to use incremental builds.
   * @default true
   */
  buildLibsFromSource?: boolean;
  /**
   * The target to use for building the library dependencies.
   * @default 'build'
   */
  buildTarget?: string;
  /**
   * The target to use for testing the library.
   * @default 'test'
   */
  testTarget?: string;
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function nxViteTsPaths(_options: nxViteTsPathsOptions = {}): Plugin {
  warnNxViteTsPathsDeprecation();
  return { name: 'nx-vite-ts-paths' };
}
