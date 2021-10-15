import { ExecutorContext } from '@nrwl/devkit';
import { of } from 'rxjs';
import * as projectGraph from '@nrwl/workspace/src/core/project-graph';
import type { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import buildExecutor from './build.impl';
import { BuildNodeBuilderOptions } from '../../utils/types';

jest.mock('../../utils/webpack/plugins/tsconfig-paths/tsconfig-paths.plugin');
jest.mock('../../utils/run-webpack', () => ({
  runWebpack: jest.fn(),
}));
import { runWebpack } from '../../utils/run-webpack';

describe('Node Build Executor', () => {
  let context: ExecutorContext;
  let options: BuildNodeBuilderOptions;

  beforeEach(async () => {
    jest
      .spyOn(projectGraph, 'readCachedProjectGraph')
      .mockReturnValue({} as ProjectGraph);

    (<any>runWebpack).mockReturnValue(of({ hasErrors: () => false }));
    context = {
      root: '/root',
      cwd: '/root',
      projectName: 'my-app',
      targetName: 'build',
      workspace: {
        version: 2,
        projects: {
          'my-app': <any>{
            root: 'apps/wibble',
            sourceRoot: 'apps/wibble',
          },
        },
        npmScope: 'test',
      },
      isVerbose: false,
    };
    options = {
      outputPath: 'dist/apps/wibble',
      externalDependencies: 'all',
      main: 'apps/wibble/src/main.ts',
      tsConfig: 'apps/wibble/tsconfig.ts',
      buildLibsFromSource: true,
      fileReplacements: [],
    };
  });

  afterEach(() => jest.clearAllMocks());

  it('should call webpack', async () => {
    await buildExecutor(options, context).next();

    expect(runWebpack).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          filename: 'main.js',
          libraryTarget: 'commonjs',
          path: '/root/dist/apps/wibble',
        }),
      })
    );
  });

  describe('webpackConfig', () => {
    it('should handle custom path', async () => {
      jest.mock(
        '/root/config.js',
        () => (options) => ({ ...options, prop: 'my-val' }),
        { virtual: true }
      );
      await buildExecutor(
        { ...options, webpackConfig: 'config.js' },
        context
      ).next();

      expect(runWebpack).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            filename: 'main.js',
            libraryTarget: 'commonjs',
            path: '/root/dist/apps/wibble',
          }),
          prop: 'my-val',
        })
      );
    });

    it('should handle multiple custom paths in order', async () => {
      jest.mock(
        '/root/config1.js',
        () => (o) => ({ ...o, prop1: 'my-val-1' }),
        { virtual: true }
      );
      jest.mock(
        '/root/config2.js',
        () => (o) => ({
          ...o,
          prop1: o.prop1 + '-my-val-2',
          prop2: 'my-val-2',
        }),
        { virtual: true }
      );
      await buildExecutor(
        { ...options, webpackConfig: ['config1.js', 'config2.js'] },
        context
      ).next();

      expect(runWebpack).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            filename: 'main.js',
            libraryTarget: 'commonjs',
            path: '/root/dist/apps/wibble',
          }),
          prop1: 'my-val-1-my-val-2',
          prop2: 'my-val-2',
        })
      );
    });
  });
});
