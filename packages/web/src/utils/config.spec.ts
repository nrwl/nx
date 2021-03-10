import { getBaseWebpackPartial } from './config';

import * as ts from 'typescript';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { ProgressPlugin } from 'webpack';
import { BuildBuilderOptions } from './types';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

jest.mock('tsconfig-paths-webpack-plugin');

describe('getBaseWebpackPartial', () => {
  let input: BuildBuilderOptions;
  beforeEach(() => {
    input = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      fileReplacements: [],
      root: '/root',
      sourceRoot: '/root/src',
      statsJson: false,
    };
    (<any>(
      TsconfigPathsPlugin
    )).mockImplementation(function MockPathsPlugin() {});
  });

  describe('unconditional options', () => {
    it('should have output filename', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.output.filename).toEqual('[name].js');
    });

    it('should have output path', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.output.path).toEqual('dist');
    });

    it('should have a rule for typescript', () => {
      const result = getBaseWebpackPartial(input);

      const rule = result.module.rules.find((rule) =>
        (rule.test as RegExp).test('app/main.ts')
      );
      expect(rule).toBeTruthy();

      expect(rule.loader).toContain('babel-loader');
    });

    it('should split typescript type checking into a separate workers', () => {
      const result = getBaseWebpackPartial(input, true);

      const typeCheckerPlugin = result.plugins.find(
        (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin).toBeTruthy();
    });

    it('should not do type checking for legacy builds', () => {
      const result = getBaseWebpackPartial(input, false);

      const typeCheckerPlugin = result.plugins.find(
        (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin).toBeFalsy();
    });

    it('should disable performance hints', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.performance).toEqual({
        hints: false,
      });
    });

    it('should resolve ts, tsx, mjs, js, and jsx', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.resolve.extensions).toEqual([
        '.ts',
        '.tsx',
        '.mjs',
        '.js',
        '.jsx',
      ]);
    });

    it('should include module and main in mainFields', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {
          target: 'es5',
        },
      });

      const result = getBaseWebpackPartial(input);
      expect(result.resolve.mainFields).toContain('module');
      expect(result.resolve.mainFields).toContain('main');
    });

    it('should configure stats', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.stats).toEqual(
        jasmine.objectContaining({
          hash: true,
          timings: false,
          cached: false,
          cachedAssets: false,
          modules: false,
          warnings: true,
          errors: true,
        })
      );
    });
  });

  describe('the main option', () => {
    it('should set the correct entry options', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.entry).toEqual({
        main: ['main.ts'],
      });
    });
  });

  describe('the output option', () => {
    it('should set the correct output options', () => {
      const result = getBaseWebpackPartial(input);

      expect(result.output.path).toEqual('dist');
    });
  });

  describe('the tsConfig option', () => {
    it('should set the correct options for the type checker plugin', () => {
      const result = getBaseWebpackPartial(input, true);

      const typeCheckerPlugin = result.plugins.find(
        (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin.options.tsconfig).toBe('tsconfig.json');
    });

    it('should add the TsConfigPathsPlugin for resolving', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {
          paths: {
            '@npmScope/libraryName': ['libs/libraryName/src/index.ts'],
          },
        },
      });
      const result = getBaseWebpackPartial(input);
      expect(
        result.resolve.plugins.some(
          (plugin) => plugin instanceof TsconfigPathsPlugin
        )
      ).toEqual(true);
    });

    it('should include es2015 in mainFields if typescript is set es2015', () => {
      const result = getBaseWebpackPartial(input, true);
      expect(result.resolve.mainFields).toContain('es2015');
    });
  });

  describe('the file replacements option', () => {
    it('should set aliases', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {},
      });

      const result = getBaseWebpackPartial({
        ...input,
        fileReplacements: [
          {
            replace: 'environments/environment.ts',
            with: 'environments/environment.prod.ts',
          },
        ],
      });

      expect(result.resolve.alias).toEqual({
        'environments/environment.ts': 'environments/environment.prod.ts',
      });
    });
  });

  describe('the watch option', () => {
    it('should enable file watching', () => {
      const result = getBaseWebpackPartial({
        ...input,
        watch: true,
      });

      expect(result.watch).toEqual(true);
    });
  });

  describe('the poll option', () => {
    it('should determine the polling rate', () => {
      const result = getBaseWebpackPartial({
        ...input,
        poll: 1000,
      });

      expect(result.watchOptions.poll).toEqual(1000);
    });
  });

  describe('the source map option', () => {
    it('should enable source-map devtool', () => {
      const result = getBaseWebpackPartial({
        ...input,
        sourceMap: true,
      });

      expect(result.devtool).toEqual('source-map');
    });

    it('should disable source-map devtool', () => {
      const result = getBaseWebpackPartial({
        ...input,
        sourceMap: false,
      });

      expect(result.devtool).toEqual(false);
    });
  });

  describe('script optimization', () => {
    describe('by default', () => {
      it('should set the mode to development', () => {
        const result = getBaseWebpackPartial(input);

        expect(result.mode).toEqual('development');
      });
    });

    describe('when true', () => {
      it('should set the mode to production', () => {
        const result = getBaseWebpackPartial(input, true, true);

        expect(result.mode).toEqual('production');
      });
    });
  });

  describe('the memory limit option', () => {
    it('should set the memory limit for the type checker', () => {
      const result = getBaseWebpackPartial(
        {
          ...input,
          memoryLimit: 1024,
        },
        true
      );

      const typeCheckerPlugin = result.plugins.find(
        (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin.options.memoryLimit).toEqual(1024);
    });
  });

  describe('the max workers option', () => {
    it('should set the maximum workers for the type checker', () => {
      const result = getBaseWebpackPartial(
        {
          ...input,
          maxWorkers: 1,
        },
        true
      );

      const typeCheckerPlugin = result.plugins.find(
        (plugin) => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin.options.workers).toEqual(1);
    });
  });

  describe('the assets option', () => {
    it('should add a copy-webpack-plugin', () => {
      const result = getBaseWebpackPartial({
        ...input,
        assets: [
          {
            input: 'assets',
            glob: '**/*',
            output: 'assets',
          },
          {
            input: '',
            glob: 'file.txt',
            output: '',
          },
        ],
      });

      expect(
        result.plugins.filter((plugin) => plugin instanceof CopyWebpackPlugin)
      ).toHaveLength(1);
    });

    it('should not add a copy-webpack-plugin if the assets option is empty', () => {
      const result = getBaseWebpackPartial({
        ...input,
        assets: [],
      });

      expect(
        result.plugins.filter((plugin) => plugin instanceof CopyWebpackPlugin)
      ).toHaveLength(0);
    });
  });

  describe('the circular dependencies option', () => {
    it('should show warnings for circular dependencies', () => {
      const result = getBaseWebpackPartial({
        ...input,
        showCircularDependencies: true,
      });

      expect(
        result.plugins.find(
          (plugin) => plugin instanceof CircularDependencyPlugin
        )
      ).toBeTruthy();
    });

    it('should exclude node modules', () => {
      const result = getBaseWebpackPartial({
        ...input,
        showCircularDependencies: true,
      });

      const circularDependencyPlugin: CircularDependencyPlugin = result.plugins.find(
        (plugin) => plugin instanceof CircularDependencyPlugin
      );
      expect(circularDependencyPlugin.options.exclude).toEqual(
        /[\\\/]node_modules[\\\/]/
      );
    });
  });

  describe('the extract licenses option', () => {
    it('should extract licenses to a separate file', () => {
      const result = getBaseWebpackPartial({
        ...input,
        extractLicenses: true,
      });

      const licensePlugin = result.plugins.find(
        (plugin) => plugin instanceof LicenseWebpackPlugin
      );

      expect(licensePlugin).toBeTruthy();
    });
  });

  describe('the progress option', () => {
    it('should show build progress', () => {
      const result = getBaseWebpackPartial({
        ...input,
        progress: true,
      });

      expect(
        result.plugins.find((plugin) => plugin instanceof ProgressPlugin)
      ).toBeTruthy();
    });
  });

  describe('the verbose option', () => {
    describe('when false', () => {
      it('should configure stats to be not verbose', () => {
        const result = getBaseWebpackPartial(input);

        expect(result.stats).toEqual(
          jasmine.objectContaining({
            colors: true,
            chunks: true,
            assets: false,
            chunkOrigins: false,
            chunkModules: false,
            children: false,
            reasons: false,
            version: false,
            errorDetails: false,
            moduleTrace: false,
            usedExports: false,
          })
        );
      });
    });

    describe('when true', () => {
      it('should configure stats to be verbose', () => {
        input.verbose = true;
        const result = getBaseWebpackPartial(input);

        expect(result.stats).toEqual(
          jasmine.objectContaining({
            colors: false,
            chunks: false,
            assets: true,
            chunkOrigins: true,
            chunkModules: true,
            children: true,
            reasons: true,
            version: true,
            errorDetails: true,
            moduleTrace: true,
            usedExports: true,
          })
        );
      });
    });
  });

  describe('babel loader', () => {
    it('should set default options', () => {
      const result = getBaseWebpackPartial({
        ...input,
        progress: true,
      });

      const rule = result.module.rules.find(
        (r) => typeof r.loader === 'string' && r.loader.match(/babel-loader/)
      );
      expect(rule.options).toMatchObject({
        rootMode: 'upward',
        cwd: '/root/root/src',
        envName: undefined,
        babelrc: true,
      });
    });

    it('should support envName overrides', () => {
      const result = getBaseWebpackPartial(
        {
          ...input,
          progress: true,
        },
        true,
        true,
        true,
        'production'
      );

      const rule = result.module.rules.find(
        (r) => typeof r.loader === 'string' && r.loader.match(/babel-loader/)
      );
      expect(rule.options).toMatchObject({
        rootMode: 'upward',
        cwd: '/root/root/src',
        envName: 'production',
        babelrc: true,
      });
    });
  });
});
