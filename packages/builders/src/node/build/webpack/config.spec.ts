import { getWebpackConfig } from './config';
import { BuildNodeBuilderOptions } from '../node-build.builder';
import { normalize, getSystemPath } from '@angular-devkit/core';

import * as ts from 'typescript';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import { ProgressPlugin } from 'webpack';

describe('getWebpackConfig', () => {
  let input: BuildNodeBuilderOptions;
  beforeEach(() => {
    input = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      externalDependencies: 'all',
      fileReplacements: [],
      root: getSystemPath(normalize('/root'))
    };
  });

  describe('unconditional options', () => {
    it('should have output options', () => {
      const result = getWebpackConfig(input);

      expect(result.output.filename).toEqual('main.js');
      expect(result.output.libraryTarget).toEqual('commonjs');
    });

    it('should have a rule for typescript', () => {
      const result = getWebpackConfig(input);

      const typescriptRule = result.module.rules.find(rule =>
        (rule.test as RegExp).test('app/main.ts')
      );
      expect(typescriptRule).toBeTruthy();

      expect(typescriptRule.loader).toEqual('ts-loader');
    });

    it('should split typescript type checking into a separate workers', () => {
      const result = getWebpackConfig(input);

      const typeCheckerPlugin = result.plugins.find(
        plugin => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin).toBeTruthy();
    });

    it('should target node', () => {
      const result = getWebpackConfig(input);

      expect(result.target).toEqual('node');
    });

    it('should disable performance hints', () => {
      const result = getWebpackConfig(input);

      expect(result.performance).toEqual({
        hints: false
      });
    });

    it('should resolve typescript and javascript', () => {
      const result = getWebpackConfig(input);

      expect(result.resolve.extensions).toEqual(['.ts', '.js']);
    });

    it('should include module and main in mainFields', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {
          target: 'es5'
        }
      });

      const result = getWebpackConfig(input);
      expect(result.resolve.mainFields).toContain('module');
      expect(result.resolve.mainFields).toContain('main');
    });

    it('should not polyfill node apis', () => {
      const result = getWebpackConfig(input);

      expect(result.node).toEqual(false);
    });
  });

  describe('the main option', () => {
    it('should set the correct entry options', () => {
      const result = getWebpackConfig(input);

      expect(result.entry).toEqual(['main.ts']);
    });
  });

  describe('the output option', () => {
    it('should set the correct output options', () => {
      const result = getWebpackConfig(input);

      expect(result.output.path).toEqual('dist');
    });
  });

  describe('the tsConfig option', () => {
    it('should set the correct typescript rule', () => {
      const result = getWebpackConfig(input);

      expect(
        result.module.rules.find(rule => rule.loader === 'ts-loader').options
      ).toEqual({
        configFile: 'tsconfig.json',
        transpileOnly: true,
        experimentalWatchApi: true
      });
    });

    it('should set the correct options for the type checker plugin', () => {
      const result = getWebpackConfig(input);

      const typeCheckerPlugin = result.plugins.find(
        plugin => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin.options.tsconfig).toBe('tsconfig.json');
    });

    it('should set aliases for compilerOptionPaths', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {
          paths: {
            '@npmScope/libraryName': ['libs/libraryName/src/index.ts']
          }
        }
      });

      const result = getWebpackConfig(input);
      expect(result.resolve.alias).toEqual({
        '@npmScope/libraryName': '/root/libs/libraryName/src/index.ts'
      });
    });

    it('should include es2015 in mainFields if typescript is set es2015', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {
          target: 'es2015'
        }
      });

      const result = getWebpackConfig(input);
      expect(result.resolve.mainFields).toContain('es2015');
    });
  });

  describe('the file replacements option', () => {
    it('should set aliases', () => {
      spyOn(ts, 'parseJsonConfigFileContent').and.returnValue({
        options: {}
      });

      const result = getWebpackConfig({
        ...input,
        fileReplacements: [
          {
            replace: 'environments/environment.ts',
            with: 'environments/environment.prod.ts'
          }
        ]
      });

      expect(result.resolve.alias).toEqual({
        'environments/environment.ts': 'environments/environment.prod.ts'
      });
    });
  });

  describe('the externalDependencies option', () => {
    it('should change all node_modules to commonjs imports', () => {
      const result = getWebpackConfig(input);
      const callback = jest.fn();
      result.externals[0](null, '@angular/core', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs @angular/core');
    });

    it('should change given module names to commonjs imports but not others', () => {
      const result = getWebpackConfig({
        ...input,
        externalDependencies: ['module1']
      });
      const callback = jest.fn();
      result.externals[0](null, 'module1', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs module1');
      result.externals[0](null, '@angular/core', callback);
      expect(callback).toHaveBeenCalledWith();
    });

    it('should not change any modules to commonjs imports', () => {
      const result = getWebpackConfig({
        ...input,
        externalDependencies: 'none'
      });

      expect(result.externals).not.toBeDefined();
    });
  });

  describe('the watch option', () => {
    it('should enable file watching', () => {
      const result = getWebpackConfig({
        ...input,
        watch: true
      });

      expect(result.watch).toEqual(true);
    });
  });

  describe('the optimization option', () => {
    describe('by default', () => {
      it('should set the mode to development', () => {
        const result = getWebpackConfig(input);

        expect(result.mode).toEqual('development');
      });
    });

    describe('when true', () => {
      it('should set the mode to production', () => {
        const result = getWebpackConfig({
          ...input,
          optimization: true
        });

        expect(result.mode).toEqual('production');
      });

      it('should not minify', () => {
        const result = getWebpackConfig({
          ...input,
          optimization: true
        });

        expect(result.optimization.minimize).toEqual(false);
      });

      it('should not concatenate modules', () => {
        const result = getWebpackConfig({
          ...input,
          optimization: true
        });

        expect(result.optimization.concatenateModules).toEqual(false);
      });
    });
  });

  describe('the max workers option', () => {
    it('should set the maximum workers for the type checker', () => {
      const result = getWebpackConfig({
        ...input,
        maxWorkers: 1
      });

      const typeCheckerPlugin = result.plugins.find(
        plugin => plugin instanceof ForkTsCheckerWebpackPlugin
      ) as ForkTsCheckerWebpackPlugin;
      expect(typeCheckerPlugin.options.workers).toEqual(1);
    });
  });

  describe('the circular dependencies option', () => {
    it('should show warnings for circular dependencies', () => {
      const result = getWebpackConfig({
        ...input,
        showCircularDependencies: true
      });

      expect(
        result.plugins.find(
          plugin => plugin instanceof CircularDependencyPlugin
        )
      ).toBeTruthy();
    });

    it('should exclude node modules', () => {
      const result = getWebpackConfig({
        ...input,
        showCircularDependencies: true
      });

      const circularDependencyPlugin: CircularDependencyPlugin = result.plugins.find(
        plugin => plugin instanceof CircularDependencyPlugin
      );
      expect(circularDependencyPlugin.options.exclude).toEqual(
        /[\\\/]node_modules[\\\/]/
      );
    });
  });

  describe('the extract licenses option', () => {
    it('should extract licenses to a separate file', () => {
      const result = getWebpackConfig({
        ...input,
        extractLicenses: true
      });

      const licensePlugin = result.plugins.find(
        plugin => plugin instanceof LicenseWebpackPlugin
      ) as LicenseWebpackPlugin;
      const options = (<any>licensePlugin).options;

      expect(licensePlugin).toBeTruthy();
      expect(options.pattern).toEqual(/.*/);
      expect(options.suppressErrors).toEqual(true);
      expect(options.perChunkOutput).toEqual(false);
      expect(options.outputFilename).toEqual('3rdpartylicenses.txt');
    });
  });

  describe('the progress option', () => {
    it('should show build progress', () => {
      const result = getWebpackConfig({
        ...input,
        progress: true
      });

      expect(
        result.plugins.find(plugin => plugin instanceof ProgressPlugin)
      ).toBeTruthy();
    });
  });
});
