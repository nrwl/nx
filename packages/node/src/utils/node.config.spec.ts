import { getNodeWebpackConfig } from './node.config';
import { getSystemPath, normalize } from '@angular-devkit/core';
import { BannerPlugin } from 'webpack';
import { BuildNodeBuilderOptions } from '../builders/build/build.builder';

describe('getNodePartial', () => {
  let input: BuildNodeBuilderOptions;
  beforeEach(() => {
    input = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      externalDependencies: 'all',
      fileReplacements: [],
      root: getSystemPath(normalize('/root')),
      statsJson: false
    };
  });

  describe('unconditionally', () => {
    it('should target commonjs', () => {
      const result = getNodeWebpackConfig(input);
      expect(result.output.libraryTarget).toEqual('commonjs');
    });

    it('should target node', () => {
      const result = getNodeWebpackConfig(input);

      expect(result.target).toEqual('node');
    });

    it('should not polyfill node apis', () => {
      const result = getNodeWebpackConfig(input);

      expect(result.node).toEqual(false);
    });
  });

  describe('the optimization option when true', () => {
    it('should not minify', () => {
      const result = getNodeWebpackConfig({
        ...input,
        optimization: true
      });

      expect(result.optimization.minimize).toEqual(false);
    });

    it('should not concatenate modules', () => {
      const result = getNodeWebpackConfig({
        ...input,
        optimization: true
      });

      expect(result.optimization.concatenateModules).toEqual(false);
    });
  });

  describe('the externalDependencies option', () => {
    it('should change all node_modules to commonjs imports', () => {
      const result = getNodeWebpackConfig(input);
      const callback = jest.fn();
      console.log(result.externals[0]);
      result.externals[0](null, 'typescript', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs typescript');
    });

    it('should change given module names to commonjs imports but not others', () => {
      const result = getNodeWebpackConfig({
        ...input,
        externalDependencies: ['module1']
      });
      const callback = jest.fn();
      result.externals[0](null, 'module1', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs module1');
      result.externals[0](null, 'externalLib', callback);
      expect(callback).toHaveBeenCalledWith();
    });

    it('should not change any modules to commonjs imports', () => {
      const result = getNodeWebpackConfig({
        ...input,
        externalDependencies: 'none'
      });

      expect(result.externals).not.toBeDefined();
    });
  });

  describe('the sourceMap option when true', () => {
    it('should add a BannerPlugin', () => {
      const result = getNodeWebpackConfig({
        ...input,
        sourceMap: true
      });

      const bannerPlugin = result.plugins.find(
        plugin => plugin instanceof BannerPlugin
      ) as BannerPlugin;
      const options = (<any>bannerPlugin).options;

      expect(bannerPlugin).toBeTruthy();
      expect(options.banner).toEqual(
        'require("source-map-support").install();'
      );
      expect(options.raw).toEqual(true);
      expect(options.entryOnly).toEqual(false);
    });
  });
});
