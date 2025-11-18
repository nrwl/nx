// Mock the module FIRST - BEFORE any imports
const mockWriteJsonFile = jest.fn();
jest.mock('nx/src/utils/fileutils', () => ({
  ...jest.requireActual('nx/src/utils/fileutils'),
  writeJsonFile: mockWriteJsonFile,
}));

// NOW import - mocks are already in place
import { updatePackageJson } from './update-package-json';
import { writeJsonFile } from 'nx/src/utils/fileutils';
import { PackageJson } from 'nx/src/utils/package-json';

describe('updatePackageJson', () => {
  beforeEach(() => {
    mockWriteJsonFile.mockReset();
  });
  const commonOptions = {
    outputPath: 'dist/index.js',
    tsConfig: './tsconfig.json',
    project: './package.json',
    main: './index.js',
    entryRoot: '.',
    projectRoot: '.',
    assets: [],
    rollupConfig: [],
  };

  describe('generateExportsField: true', () => {
    it('should support ESM', () => {
      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['esm'],
        },
        {} as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': {
            import: './index.esm.js',
            types: './index.d.ts',
          },
        },
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        types: './index.d.ts',
      });
    });

    it('should support CJS', () => {
      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['cjs'],
        },
        {} as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': './index.cjs.js',
        },
        main: './index.cjs.js',
        type: 'commonjs',
        types: './index.d.ts',
      });
    });

    it('should support ESM + CJS', () => {
      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['esm', 'cjs'],
        },
        {} as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': {
            module: './index.esm.js',
            import: './index.cjs.mjs',
            default: './index.cjs.js',
            types: './index.d.ts',
          },
        },
        main: './index.cjs.js',
        module: './index.esm.js',
        types: './index.d.ts',
      });
    });

    it('should support custom exports field', () => {
      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['esm'],
        },
        {
          exports: {
            './foo': {
              import: './some/custom/path/foo.esm.js',
              types: './some/custom/path/foo.d.ts',
            },
          },
        } as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': {
            import: './index.esm.js',
            types: './index.d.ts',
          },
          './foo': {
            import: './some/custom/path/foo.esm.js',
            types: './some/custom/path/foo.d.ts',
          },
        },
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        types: './index.d.ts',
      });
    });
  });

  describe('generateExportsField: false', () => {
    it('should support ESM', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
        },
        {} as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        types: './index.d.ts',
      });
    });

    it('should support CJS', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['cjs'],
        },
        {} as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.cjs.js',
        type: 'commonjs',
        types: './index.d.ts',
      });
    });

    it('should support ESM + CJS', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm', 'cjs'],
        },
        {} as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.cjs.js',
        module: './index.esm.js',
        types: './index.d.ts',
      });
    });

    it('should support custom exports field', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
        },
        {
          exports: {
            './foo': './foo.esm.js',
          },
        } as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        types: './index.d.ts',
        exports: {
          './foo': './foo.esm.js',
        },
      });
    });
  });

  describe('skipTypeField', () => {
    it('should not include type field if skipTypeField is true', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
          skipTypeField: true,
        },
        {
          exports: {
            './foo': './foo.esm.js',
          },
        } as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        types: './index.d.ts',
        exports: {
          './foo': './foo.esm.js',
        },
      });
    });

    it('should include type field if skipTypeField is undefined', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
        },
        {
          exports: {
            './foo': './foo.esm.js',
          },
        } as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        types: './index.d.ts',
        exports: {
          './foo': './foo.esm.js',
        },
      });
    });

    it('should include type field if skipTypeField is false', () => {
      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
          skipTypeField: false,
        },
        {
          exports: {
            './foo': './foo.esm.js',
          },
        } as unknown as PackageJson
      );

      expect(mockWriteJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        types: './index.d.ts',
        exports: {
          './foo': './foo.esm.js',
        },
      });
    });
  });
});
