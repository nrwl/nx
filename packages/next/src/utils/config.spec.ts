import 'nx/src/utils/testing/mock-fs';
import { createWebpackConfig } from './config';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

jest.mock('@nrwl/webpack', () => ({}));
jest.mock('tsconfig-paths-webpack-plugin');
jest.mock('next/dist/server/config', () => ({
  __esModule: true,
  default: () => ({
    webpack: () => ({}),
  }),
}));

describe('Next.js webpack config builder', () => {
  beforeEach(() => {
    (TsconfigPathsPlugin as any).mockClear();
  });

  describe('createWebpackConfig', () => {
    it('should set the resolve plugins', () => {
      const webpackConfig = createWebpackConfig('/root', 'apps/wibble', []);

      webpackConfig(
        { resolve: { alias: {} }, module: { rules: [] }, plugins: [] },
        { defaultLoaders: {} }
      );

      expect(TsconfigPathsPlugin).toHaveBeenCalledWith({
        configFile: expect.stringMatching(/tsconfig/),
        extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
        mainFields: ['es2015', 'module', 'main'],
      });
    });

    it('should set the resolve aliases', () => {
      const webpackConfig = createWebpackConfig('/root', 'apps/wibble', [
        {
          replace: 'apps/wibble/src/environment.ts',
          with: 'apps/wibble/src/environment.prod.ts',
        },
      ]);

      const config = webpackConfig(
        { resolve: { alias: {} }, module: { rules: [] }, plugins: [] },
        { defaultLoaders: {} }
      );

      expect(config.resolve.alias).toEqual({
        '/root/apps/wibble/src/environment.ts':
          '/root/apps/wibble/src/environment.prod.ts',
      });
    });

    it('should add rules for ts', () => {
      const webpackConfig = createWebpackConfig('/root', 'apps/wibble', []);

      const config = webpackConfig(
        {
          resolve: { alias: {} },
          module: {
            rules: [
              {
                test: /\.*.ts/,
                loader: 'some-ts-loader',
              },
            ],
          },
          plugins: [],
        },
        { defaultLoaders: {} }
      );

      // not much value in checking what they are
      // just check they get added
      expect(config.module.rules.length).toBe(2);
    });
  });
});
