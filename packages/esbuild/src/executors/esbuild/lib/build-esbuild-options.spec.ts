import { buildEsbuildOptions } from './build-esbuild-options';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';

describe('buildEsbuildOptions', () => {
  const context: ExecutorContext = {
    workspace: {
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
        },
      },
    },
    isVerbose: false,
    root: '/',
    cwd: '/',
    target: {
      executor: '@nrwl/esbuild:esbuild',
      options: {
        outputPath: 'dist/apps/myapp',
      },
    },
  };

  it('should include environment variables for platform === browser', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          platform: 'browser',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          project: 'apps/myapp/package.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: true,
          external: [],
        },
        context
      )
    ).toEqual({
      bundle: true,
      define: expect.objectContaining({
        'process.env.NODE_ENV': '"test"',
      }),
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'browser',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.js',
      },
    });
  });

  it('should support multiple entry points', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          platform: 'browser',
          main: 'apps/myapp/src/index.ts',
          additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          project: 'apps/myapp/package.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: false,
          external: [],
        },
        context
      )
    ).toEqual({
      bundle: true,
      define: expect.objectContaining({
        'process.env.NODE_ENV': '"test"',
      }),
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts', 'apps/myapp/src/extra-entry.ts'],
      format: 'esm',
      platform: 'browser',
      outdir: 'dist/apps/myapp',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.js',
      },
    });
  });

  it('should support cjs format', () => {
    expect(
      buildEsbuildOptions(
        'cjs',
        {
          platform: 'browser',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          project: 'apps/myapp/package.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: true,
          external: [],
        },
        context
      )
    ).toEqual({
      bundle: true,
      define: expect.objectContaining({
        'process.env.NODE_ENV': '"test"',
      }),
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'cjs',
      platform: 'browser',
      outfile: 'dist/apps/myapp/index.cjs',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.cjs',
      },
    });
  });

  it('should not define environment variables for node', () => {
    expect(
      buildEsbuildOptions(
        'cjs',
        {
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          project: 'apps/myapp/package.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: true,
          external: [],
        },
        context
      )
    ).toEqual({
      bundle: true,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'cjs',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.cjs',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.cjs',
      },
    });
  });
});
