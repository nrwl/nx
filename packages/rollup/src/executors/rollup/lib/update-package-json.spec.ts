import { updatePackageJson } from './update-package-json';
import * as utils from 'nx/src/utils/fileutils';
import { PackageJson } from 'nx/src/utils/package-json';

describe('updatePackageJson', () => {
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

  const sharedContext = {
    isVerbose: false,
    projectsConfigurations: { version: 2, projects: {} },
    nxJsonConfiguration: {},
    root: '',
    cwd: '',
  };

  // TODO(jack): In Nx 15 we want this field to always generate.
  describe('generateExportsField: true', () => {
    it('should support ESM', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['esm'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {} as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': './index.esm.js',
        },
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
      });

      spy.mockRestore();
    });

    it('should support CJS', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['cjs'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {} as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': './index.cjs.js',
        },
        main: './index.cjs.js',
        type: 'commonjs',
      });

      spy.mockRestore();
    });

    it('should support ESM + CJS', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['esm', 'cjs'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {} as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': {
            module: './index.esm.js',
            import: './index.cjs.mjs',
            default: './index.cjs.js',
          },
        },
        main: './index.cjs.js',
        module: './index.esm.js',
      });

      spy.mockRestore();
    });

    it('should support custom exports field', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          generateExportsField: true,
          format: ['esm'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {
          exports: {
            './foo': './foo.esm.js',
          },
        } as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        exports: {
          './package.json': './package.json',
          '.': './index.esm.js',

          './foo': './foo.esm.js',
        },
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
      });

      spy.mockRestore();
    });
  });

  describe('generateExportsField: false', () => {
    it('should support ESM', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {} as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
      });

      spy.mockRestore();
    });

    it('should support CJS', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          format: ['cjs'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {} as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.cjs.js',
        type: 'commonjs',
      });

      spy.mockRestore();
    });

    it('should support ESM + CJS', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm', 'cjs'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {} as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.cjs.js',
        module: './index.esm.js',
      });

      spy.mockRestore();
    });

    it('should support custom exports field', () => {
      const spy = jest.spyOn(utils, 'writeJsonFile');

      updatePackageJson(
        {
          ...commonOptions,
          format: ['esm'],
        },
        sharedContext,
        { type: 'app', name: 'test', data: {} as any },
        [],
        {
          exports: {
            './foo': './foo.esm.js',
          },
        } as unknown as PackageJson
      );

      expect(utils.writeJsonFile).toHaveBeenCalledWith(expect.anything(), {
        main: './index.esm.js',
        module: './index.esm.js',
        type: 'module',
        exports: {
          './foo': './foo.esm.js',
        },
      });

      spy.mockRestore();
    });
  });
});
