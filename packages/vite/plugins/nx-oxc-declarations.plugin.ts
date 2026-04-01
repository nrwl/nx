import type { Plugin } from 'vite';

export interface NxOxcDeclarationsPluginOptions {
  /**
   * The root directory of the project (where src/ lives).
   * Defaults to `import.meta.dirname` if not provided.
   */
  projectRoot?: string;
  /**
   * The source directory to walk for tree-shaken type-only files.
   * Defaults to `${projectRoot}/src`.
   */
  sourceRoot?: string;
  /**
   * Whether to generate source maps for declaration files.
   * Defaults to `false`.
   */
  sourcemap?: boolean;
  /**
   * Whether to strip `@internal` JSDoc annotations from declarations.
   * Defaults to `false`.
   */
  stripInternal?: boolean;
}

/**
 * Vite plugin that generates TypeScript declaration files (.d.ts) using
 * oxc-transform's `isolatedDeclaration` instead of the TypeScript compiler.
 *
 * This is a faster alternative to `vite-plugin-dts` for projects that have
 * `isolatedDeclarations: true` enabled in their tsconfig.
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { nxOxcDeclarationsPlugin } from '@nx/vite/plugins/nx-oxc-declarations.plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     nxOxcDeclarationsPlugin({ projectRoot: import.meta.dirname }),
 *   ],
 * });
 * ```
 */
export function nxOxcDeclarationsPlugin(
  options: NxOxcDeclarationsPluginOptions = {}
): Plugin {
  // Re-export the shared implementation from @nx/js
  const {
    oxcDeclarations,
  } = require('@nx/js/src/plugins/rollup/oxc-declarations');
  return oxcDeclarations({
    projectRoot: options.projectRoot ?? process.cwd(),
    sourceRoot: options.sourceRoot,
    sourcemap: options.sourcemap,
    stripInternal: options.stripInternal,
  }) as Plugin;
}
