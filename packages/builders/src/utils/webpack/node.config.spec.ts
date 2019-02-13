import { getNodeWebpackConfig } from './node.config';
import { getSystemPath, normalize } from '@angular-devkit/core';
import { BuildNodeBuilderOptions } from '../../node/build/node-build.builder';

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

  describe('the externalDependencies option', () => {
    it('should change all node_modules to commonjs imports', () => {
      const result = getNodeWebpackConfig(input);
      const callback = jest.fn();
      result.externals[0](null, '@angular/core', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs @angular/core');
    });

    it('should change given module names to commonjs imports but not others', () => {
      const result = getNodeWebpackConfig({
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
      const result = getNodeWebpackConfig({
        ...input,
        externalDependencies: 'none'
      });

      expect(result.externals).not.toBeDefined();
    });
  });
});
