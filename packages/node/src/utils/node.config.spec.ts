import { ProjectGraph, ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

import { GeneratePackageJsonWebpackPlugin } from './generate-package-json-webpack-plugin';
import { getNodeWebpackConfig } from './node.config';
import { BuildNodeBuilderOptions } from './types';

jest.mock('tsconfig-paths-webpack-plugin');
jest.mock('@nrwl/devkit', () => ({
  get workspaceRoot() {
    return join(__dirname, '../../../..');
  },
}));

describe('getNodePartial', () => {
  let context: ExecutorContext;
  let projectGraph: ProjectGraph;
  let input: BuildNodeBuilderOptions;
  beforeEach(() => {
    context = {
      projectName: 'sample-project',
      root: '/root',
      cwd: '',
      target: {} as any,
      isVerbose: false,
      workspace: {} as any,
    };
    projectGraph = {} as any;
    input = {
      main: 'main.ts',
      outputPath: 'dist',
      tsConfig: 'tsconfig.json',
      externalDependencies: 'all',
      fileReplacements: [],
      statsJson: false,
    };
    (<any>TsconfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );
  });

  describe('unconditionally', () => {
    it('should target commonjs', () => {
      const result = getNodeWebpackConfig(context, projectGraph, input);
      expect(result.output.libraryTarget).toEqual('commonjs');
    });

    it('should target node', () => {
      const result = getNodeWebpackConfig(context, projectGraph, input);

      expect(result.target).toEqual('node');
    });

    it('should not polyfill node apis', () => {
      const result = getNodeWebpackConfig(context, projectGraph, input);

      expect(result.node).toEqual(false);
    });
  });

  describe('the optimization option when true', () => {
    it('should minify', () => {
      const result = getNodeWebpackConfig(context, projectGraph, {
        ...input,
        optimization: true,
      });

      expect(result.optimization.minimize).toEqual(true);
      expect(result.optimization.minimizer).toBeDefined();
    });

    it('should concatenate modules', () => {
      const result = getNodeWebpackConfig(context, projectGraph, {
        ...input,
        optimization: true,
      });

      expect(result.optimization.concatenateModules).toEqual(true);
    });
  });

  describe('the externalDependencies option', () => {
    it('should change all node_modules to commonjs imports', () => {
      const result = getNodeWebpackConfig(context, projectGraph, input);
      const callback = jest.fn();
      result.externals[0](null, '@nestjs/core', callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs @nestjs/core');
    });

    it('should change given module names to commonjs imports but not others', () => {
      const result = getNodeWebpackConfig(context, projectGraph, {
        ...input,
        externalDependencies: ['module1'],
      });
      const callback = jest.fn();
      result.externals[0]({ request: 'module1' }, callback);
      expect(callback).toHaveBeenCalledWith(null, 'commonjs module1');
      result.externals[0]({ request: '@nestjs/core' }, callback);
      expect(callback).toHaveBeenCalledWith();
    });

    it('should not change any modules to commonjs imports', () => {
      const result = getNodeWebpackConfig(context, projectGraph, {
        ...input,
        externalDependencies: 'none',
      });

      expect(result.externals).not.toBeDefined();
    });
  });

  describe('the generatePackageJson option', () => {
    it('should add the GeneratePackageJsonWebpackPlugin plugin', () => {
      const result = getNodeWebpackConfig(context, projectGraph, {
        ...input,
        generatePackageJson: true,
      });
      expect(
        result.plugins.find(
          (plugin) => plugin instanceof GeneratePackageJsonWebpackPlugin
        )
      ).toBeTruthy();
    });
    it('should not add the GeneratePackageJsonWebpackPlugin plugin', () => {
      const result = getNodeWebpackConfig(context, projectGraph, {
        ...input,
        generatePackageJson: false,
      });
      expect(
        result.plugins.find(
          (plugin) => plugin instanceof GeneratePackageJsonWebpackPlugin
        )
      ).toBeFalsy();
    });
  });
});
