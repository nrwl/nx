import type { PackageJson } from '@nx/devkit/internal';
import type { NormalizedSchema } from '../schema';

export function determineEntryFields(
  options: NormalizedSchema
): Pick<PackageJson, 'module' | 'types' | 'exports'> {
  if (options.bundler !== 'none' || !options.isUsingTsSolutionConfig) {
    // for buildable libraries, the entries are configured by the bundler
    return undefined;
  }

  return {
    module: options.js ? './src/index.js' : './src/index.ts',
    types: options.js ? './src/index.js' : './src/index.ts',
    exports: {
      '.': options.js
        ? './src/index.js'
        : {
            types: './src/index.ts',
            import: './src/index.ts',
            default: './src/index.ts',
          },
      './package.json': './package.json',
    },
  };
}
