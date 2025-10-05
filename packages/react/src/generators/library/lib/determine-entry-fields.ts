import type { PackageJson } from 'nx/src/utils/package-json';
import type { NormalizedSchema } from '../schema';

export function determineEntryFields(
  options: NormalizedSchema
): Pick<PackageJson, 'main' | 'types' | 'exports'> {
  if (options.bundler !== 'none') {
    return {};
  }

  return {
    main: options.js ? './src/index.js' : './src/index.ts',
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
