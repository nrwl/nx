import { normalizeOptions } from './normalize';

describe('normalizeOptions', () => {
  it('should handle single entry point options', () => {
    expect(
      normalizeOptions({
        main: 'apps/myapp/src/index.ts',
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.app.json',
        project: 'apps/myapp/package.json',
        assets: [],
        generateTypings: false,
      })
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      project: 'apps/myapp/package.json',
      assets: [],
      outputFileName: 'index.js',
      singleEntry: true,
      external: [],
      generateTypings: false,
    });
  });

  it('should handle multiple entry point options', () => {
    expect(
      normalizeOptions({
        main: 'apps/myapp/src/index.ts',
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.app.json',
        project: 'apps/myapp/package.json',
        assets: [],
        additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
        generateTypings: false,
      })
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      project: 'apps/myapp/package.json',
      assets: [],
      additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
      singleEntry: false,
      external: [],
      generateTypings: false,
    });
  });

  it('should support custom output file name', () => {
    expect(
      normalizeOptions({
        main: 'apps/myapp/src/index.ts',
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.app.json',
        project: 'apps/myapp/package.json',
        assets: [],
        outputFileName: 'test.js',
        generateTypings: false,
      })
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      project: 'apps/myapp/package.json',
      assets: [],
      outputFileName: 'test.js',
      singleEntry: true,
      external: [],
      generateTypings: false,
    });
  });

  it('should validate against multiple entry points + outputFileName', () => {
    expect(() =>
      normalizeOptions({
        main: 'apps/myapp/src/index.ts',
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.app.json',
        project: 'apps/myapp/package.json',
        assets: [],
        additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
        outputFileName: 'test.js',
        generateTypings: false,
      })
    ).toThrow(/Cannot use/);
  });
});
