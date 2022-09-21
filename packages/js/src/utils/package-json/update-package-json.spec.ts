import { getUpdatedPackageJsonContent } from './update-package-json';

describe('getUpdatedPackageJsonContent', () => {
  it('should update fields for commonjs only (default)', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should update fields for esm only', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        format: ['esm'],
      }
    );

    expect(json).toEqual({
      name: 'test',
      type: 'module',
      module: './src/index.js',
      main: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should update fields for commonjs + esm', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        format: ['esm', 'cjs'],
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      module: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should support skipping types', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        skipTypings: true,
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      version: '0.0.1',
    });
  });

  it('should support generated exports field', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        format: ['esm'],
        generateExportsField: true,
      }
    );

    expect(json).toEqual({
      name: 'test',
      type: 'module',
      main: './src/index.js',
      module: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
      exports: {
        '.': { import: './src/index.js' },
      },
    });
  });

  it('should support different CJS file extension', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        format: ['esm', 'cjs'],
        outputFileExtensionForCjs: '.cjs',
        generateExportsField: true,
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.cjs',
      module: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
      exports: {
        '.': { require: './src/index.cjs', import: './src/index.js' },
      },
    });
  });
});
