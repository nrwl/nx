import { buildEsbuildOptions, getRegisterFileContent } from './build-esbuild-options';
import { ExecutorContext } from '@nx/devkit';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: true,
      define: expect.objectContaining({
        'process.env.NODE_ENV': '"test"',
      }),
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'browser',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: true,
      define: expect.objectContaining({
        'process.env.NODE_ENV': '"test"',
      }),
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts', 'apps/myapp/src/extra-entry.ts'],
      format: 'esm',
      platform: 'browser',
      outdir: 'dist/apps/myapp',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: true,
      define: expect.objectContaining({
        'process.env.NODE_ENV': '"test"',
      }),
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'cjs',
      platform: 'browser',
      outfile: 'dist/apps/myapp/index.cjs',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: true,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'cjs',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.cjs',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
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
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.mjs',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
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
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'cjs',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
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
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {
            external: ['bar'],
          },
        },
        context
      )
    ).toEqual({
      bundle: true,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: false,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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

  it('should exclude packages from external list using excludeFromExternal', () => {
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
          external: ['foo', 'bar', 'baz'],
          excludeFromExternal: ['bar'],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: true,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
      external: ['foo', 'baz'],
      outExtension: {
        '.js': '.js',
      },
      metafile: undefined,
      minify: undefined,
      target: undefined,
      sourcemap: false,
    });
  });

  it('should exclude packages from both user-defined and Nx external lists', () => {
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
          external: ['foo', 'fsevents'],
          excludeFromExternal: ['fsevents'],
          userDefinedBuildOptions: {
            external: ['bar', 'fsevents'],
          },
        },
        context
      )
    ).toEqual({
      bundle: true,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outfile: 'dist/apps/myapp/index.js',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: false,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
          userDefinedBuildOptions: {},
        },
        context
      )
    ).toEqual({
      bundle: false,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
          excludeFromExternal: [],
        },
        context
      )
    ).toEqual({
      bundle: false,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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

  describe('getRegisterFileContent', () => {
    const project = {
      type: 'app' as const,
      name: 'myapp',
      data: { root: 'apps/myapp' },
    };

    it('should not use require.resolve in the CJS isFile helper', () => {
      const content = getRegisterFileContent(
        project,
        { '@acme/lib': ['libs/lib/src/index.ts'] },
        './apps/myapp/src/main.js',
        '.js',
        'cjs'
      );

      expect(content).not.toContain('require.resolve');
      expect(content).toContain('fs.statSync(candidate).isFile()');
    });

    it('should resolve workspace imports without recursion', () => {
      const distPath = mkdtempSync(join(tmpdir(), 'nx-esbuild-isfile-'));
      const appMain = join(distPath, 'apps/myapp/src/main.js');
      mkdirSync(join(distPath, 'apps/myapp/src'), { recursive: true });
      mkdirSync(join(distPath, 'libs/lib/src'), { recursive: true });
      writeFileSync(appMain, "module.exports = require('@acme/lib');");
      writeFileSync(
        join(distPath, 'libs/lib/src/index.js'),
        'module.exports = { ok: true };'
      );

      const content = getRegisterFileContent(
        project,
        { '@acme/lib': ['libs/lib/src/index.ts'] },
        './apps/myapp/src/main.js',
        '.js',
        'cjs'
      );

      writeFileSync(join(distPath, 'main.js'), content);

      const start = Date.now();
      const output = execFileSync(
        process.execPath,
        [
          '-e',
          `console.log(JSON.stringify(require(${JSON.stringify(
            join(distPath, 'main.js')
          )})))`,
        ],
        { encoding: 'utf8' }
      );
      expect(JSON.parse(output.trim())).toEqual({ ok: true });
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('should resolve wildcard paths to index.js without recursion', () => {
      const distPath = mkdtempSync(join(tmpdir(), 'nx-esbuild-isfile-'));
      const appMain = join(distPath, 'apps/myapp/src/main.js');
      mkdirSync(join(distPath, 'apps/myapp/src/config'), { recursive: true });
      writeFileSync(appMain, "module.exports = require('@app/config');");
      writeFileSync(
        join(distPath, 'apps/myapp/src/config/index.js'),
        'module.exports = { ok: true };'
      );

      const content = getRegisterFileContent(
        project,
        { '@app/*': ['apps/myapp/src/*'] },
        './apps/myapp/src/main.js',
        '.js',
        'cjs'
      );

      writeFileSync(join(distPath, 'main.js'), content);

      const output = execFileSync(
        process.execPath,
        [
          '-e',
          `console.log(JSON.stringify(require(${JSON.stringify(
            join(distPath, 'main.js')
          )})))`,
        ],
        { encoding: 'utf8' }
      );
      expect(JSON.parse(output.trim())).toEqual({ ok: true });
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
          excludeFromExternal: [],
        },
        context
      )
    ).toEqual({
      bundle: false,
      absWorkingDir: context.root,
      entryNames: '[dir]/[name]',
      entryPoints: ['apps/myapp/src/index.ts'],
      format: 'esm',
      platform: 'node',
      outdir: 'dist/apps/myapp',
      tsconfig: path.join(context.root, 'apps/myapp/tsconfig.app.json'),
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
