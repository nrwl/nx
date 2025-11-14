import { Plugin } from 'vite';
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
   * @default ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs']
   **/
  extensions?: string[];
  /**
   * Inform Nx whether to use the raw source or to use the built output for buildable dependencies.
   * Set to `false` to use incremental builds.
   * @default true
   */
  buildLibsFromSource?: boolean;
}
export declare function nxViteTsPaths(options?: nxViteTsPathsOptions): Plugin;
//# sourceMappingURL=nx-tsconfig-paths.plugin.d.ts.map
