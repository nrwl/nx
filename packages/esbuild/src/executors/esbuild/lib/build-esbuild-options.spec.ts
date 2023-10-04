import { buildEsbuildOptions } from './build-esbuild-options';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import path = require('path');

describe('buildEsbuildOptions', () => {
  const context: ExecutorContext = {
    projectName: 'myapp',
    projectsConfigurations: {
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
        },
      },
    },
    projectGraph: {
      nodes: {
        myapp: {
          type: 'app',
          name: 'myapp',
          data: { root: 'apps/myapp' },
        },
      },
      dependencies: { myapp: [] },
    },
    nxJsonConfiguration: {},
    isVerbose: false,
    root: path.join(__dirname, 'fixtures'),
    cwd: path.join(__dirname, 'fixtures'),
    target: {
      executor: '@nx/esbuild:esbuild',
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
          bundle: true,
          platform: 'browser',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {},
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
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should support multiple entry points', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: true,
          platform: 'browser',
          main: 'apps/myapp/src/index.ts',
          additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: false,
          external: [],
          userDefinedBuildOptions: {},
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
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should support cjs format', () => {
    expect(
      buildEsbuildOptions(
        'cjs',
        {
          bundle: true,
          platform: 'browser',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {},
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
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should not define environment variables for node', () => {
    expect(
      buildEsbuildOptions(
        'cjs',
        {
          bundle: true,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          outputFileName: 'index.js',
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {},
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
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should respect user defined outExtension', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: true,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {
            outExtension: {
              '.js': '.mjs',
            },
          },
        },
        context
      )
    ).toEqual({
      bundle: true,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.mjs',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.mjs',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });

    expect(
      buildEsbuildOptions(
        'cjs',
        {
          bundle: true,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {
            outExtension: {
              '.js': '.js',
            },
          },
        },
        context
      )
    ).toEqual({
      bundle: true,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'cjs',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.js',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });

    // ESM cannot be mapped to .cjs so ignore
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: true,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {
            outExtension: {
              '.js': '.cjs',
            },
          },
        },
        context
      )
    ).toEqual({
      bundle: true,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: [],
      outExtension: {
        '.js': '.js',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should respect user defined external', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: true,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          singleEntry: true,
          outputFileName: 'index.js',
          external: ['foo'],
          userDefinedBuildOptions: {
            external: ['bar'],
          },
        },
        context
      )
    ).toEqual({
      bundle: true,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: ['bar', 'foo'],
      outExtension: {
        '.js': '.js',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should not set external if --bundle=false', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: false,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          singleEntry: true,
          external: ['foo'],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: false,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: undefined,
      outExtension: {
        '.js': '.js',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should set sourcemap', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: false,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          sourcemap: true,
          external: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: false,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: undefined,
      sourcemap: true,
      outExtension: {
        '.js': '.js',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
    });
  });

  it('should default to false for sourcemap', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: false,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          external: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: false,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: undefined,
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
      outExtension: {
        '.js': '.js',
      },
    });
  });

  it('should set sourcemap when passed via the esbuildOptions', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: false,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          userDefinedBuildOptions: {
            sourcemap: true,
          },
          external: [],
        },
        context
      )
    ).toEqual({
      bundle: false,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: undefined,
      sourcemap: true,
      metafile: undefined,
      minify: undefined,
      target: undefined,
      outExtension: {
        '.js': '.js',
      },
    });
  });

  it('the base options sourcemap property should supercede the one passed via the esbuildOptions', () => {
    expect(
      buildEsbuildOptions(
        'esm',
        {
          bundle: false,
          platform: 'node',
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          outputFileName: 'index.js',
          assets: [],
          singleEntry: true,
          userDefinedBuildOptions: {
            sourcemap: false,
          },
          sourcemap: true,
          external: [],
        },
        context
      )
    ).toEqual({
      bundle: false,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: 'apps/myapp/tsconfig.app.json',
      external: undefined,
      sourcemap: true,
      metafile: undefined,
      minify: undefined,
      target: undefined,
      outExtension: {
        '.js': '.js',
      },
    });
  });
});
