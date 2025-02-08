import type { PackageJson } from 'nx/src/utils/package-json';

export function determineEntryFields(
  bundler: string,
  js: boolean
): Pick<PackageJson, 'main' | 'types' | 'exports'> {
  if (bundler !== 'none') {
    return {};
  }

  return {
    main: js ? './src/index.js' : './src/index.ts',
    types: js ? './src/index.js' : './src/index.ts',
    exports: {
      '.': js
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
