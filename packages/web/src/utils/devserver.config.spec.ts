import { getDevServerConfig } from '@nrwl/web/src/utils/devserver.config';

jest.mock('./webpack/partials/common', () => ({
  getCommonConfig: () => ({
    output: {},
    resolve: {},
  }),
  getCommonPartial: () => ({}),
}));

jest.mock('tsconfig-paths-webpack-plugin', () => ({
  TsconfigPathsPlugin: class TsconfigPathsPlugin {},
}));

describe('getDevServerConfig', () => {
  it('should set mode to production when optimization is on', () => {
    const result = getDevServerConfig(
      '/',
      '/app',
      '/app/src',
      {
        optimization: true,
        root: '/app',
        sourceRoot: '/app/src',
        main: '/app/src/main.ts',
        outputPath: '/dist/app',
        tsConfig: '/app/tsconfig.app.json',
        compiler: 'babel',
        assets: [],
        fileReplacements: [],
        index: '/app/src/index.html',
        scripts: [],
        styles: [],
      },
      {
        buildTarget: 'app:build:production',
        allowedHosts: '',
        liveReload: false,
        hmr: false,
        ssl: false,
        watch: false,
        open: false,
        host: 'localhost',
        port: 4200,
      }
    );

    expect(result.mode).toEqual('production');
  });

  it('should set mode to development when optimization is off', () => {
    const result = getDevServerConfig(
      '/',
      '/app',
      '/app/src',
      {
        root: '/app',
        sourceRoot: '/app/src',
        main: '/app/src/main.ts',
        outputPath: '/dist/app',
        tsConfig: '/app/tsconfig.app.json',
        compiler: 'babel',
        assets: [],
        fileReplacements: [],
        index: '/app/src/index.html',
        scripts: [],
        styles: [],
      },
      {
        buildTarget: 'app:build:development',
        allowedHosts: '',
        liveReload: false,
        hmr: false,
        ssl: false,
        watch: false,
        open: false,
        host: 'localhost',
        port: 4200,
      }
    );

    expect(result.mode).toEqual('development');
  });
});
