import {
  getUpdatedPackageJsonContent,
  UpdatePackageJsonOption,
} from './update-package-json';
import type { PackageJson } from 'nx/src/utils/package-json';

describe('getUpdatedPackageJsonContent', () => {
  let packageJson: PackageJson;
  let testOptions: UpdatePackageJsonOption;

  beforeEach(async () => {
    packageJson = {
      name: 'test',
      version: '0.0.1',
    };
    testOptions = {
      main: 'proj/src/index.ts',
      outputPath: 'dist/proj',
      projectRoot: 'proj',
      rootDir: 'proj',
    };
  });

  it('should update fields for commonjs only (default)', () => {
    const json = getUpdatedPackageJsonContent(packageJson, testOptions);

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should support custom rootDir', () => {
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      rootDir: 'proj/src',
    });

    expect(json).toEqual({
      name: 'test',
      main: './index.js',
      types: './index.d.ts',
      version: '0.0.1',
    });
  });

  it('should update fields for esm only', () => {
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      format: ['esm'],
    });

    expect(json).toMatchObject({
      name: 'test',
      type: 'module',
      module: './src/index.js',
      main: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should update fields for commonjs + esm', () => {
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      format: ['esm', 'cjs'],
    });

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      module: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should support skipping types', () => {
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      skipTypings: true,
    });

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      version: '0.0.1',
    });
  });

  it('should support generated exports field', () => {
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      format: ['esm'],
      generateExportsField: true,
    });

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
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      format: ['esm', 'cjs'],
      outputFileExtensionForCjs: '.cjs',
      generateExportsField: true,
    });

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

  it('should not set types when { skipTypings: true }', () => {
    const json = getUpdatedPackageJsonContent(packageJson, {
      ...testOptions,
      skipTypings: true,
    });

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      version: '0.0.1',
    });
  });
});
