import type { Bundler } from '../schema';
import { swcHelpersVersion, tsLibVersion } from '../versions';

export function determinePackageDependencies(
  bundler: Bundler
): Record<string, string> {
  switch (bundler) {
    case 'tsc':
      // importHelpers is true by default, so need to add tslib as a dependency.
      return {
        tslib: tsLibVersion,
      };
    case 'swc':
      // externalHelpers is true  by default, so need to add swc helpers as a dependency.
      return {
        '@swc/helpers': swcHelpersVersion,
      };
    default: {
      // In other cases (vite, rollup, esbuild), helpers are bundled so no need to add them as a dependency.
      return {};
    }
  }
}

type EntryField = string | { [key: string]: EntryField };

export function determinePackageEntryFields(
  bundler: Bundler
): Record<string, EntryField> {
  switch (bundler) {
    case 'tsc':
      return {
        type: 'commonjs',
        main: './src/index.js',
        typings: './src/index.d.ts',
      };
    case 'swc':
      return {
        type: 'commonjs',
        main: './src/index.js',
        typings: './src/index.d.ts',
      };
    case 'rollup':
      return {
        type: 'commonjs',
        main: './index.cjs',
        module: './index.js',
        // typings is missing for rollup currently
      };
    case 'vite':
      return {
        // Since we're publishing both formats, skip the type field.
        // Bundlers or Node will determine the entry point to use.
        main: './index.js',
        module: './index.mjs',
        typings: './index.d.ts',
      };
    case 'esbuild':
      // For libraries intended for Node, use CJS.
      return {
        type: 'commonjs',
        main: './index.cjs',
        // typings is missing for esbuild currently
      };
    default: {
      return {
        // CJS is the safest optional for now due to lack of support from some packages
        // also setting `type: module` results in different resolution behavior (e.g. import 'foo' no longer resolves to 'foo/index.js')
        type: 'commonjs',
      };
    }
  }
}
