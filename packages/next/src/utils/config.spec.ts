import { PHASE_PRODUCTION_BUILD } from 'next/dist/next-server/lib/constants';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { createWebpackConfig, prepareConfig } from './config';

jest.mock('tsconfig-paths-webpack-plugin');
jest.mock('@zeit/next-css', () => (config: any) => config);
jest.mock('@zeit/next-less', () => (config: any) => config);
jest.mock('@zeit/next-sass', () => (config: any) => config);
jest.mock('@zeit/next-stylus', () => (config: any) => config);
jest.mock('next/dist/next-server/server/config', () => ({
  __esModule: true,
  default: () => ({
    webpack: () => ({})
  })
}));

describe('Next.js webpack config builder', () => {
  beforeEach(() => {
    (TsconfigPathsPlugin as any).mockClear();
  });

  describe('createWebpackConfig', () => {
    it('should set the resolve plugins', () => {
      const webpackConfig = createWebpackConfig('/root', 'apps/wibble', []);

      const config = webpackConfig(
        { resolve: { alias: {} }, module: { rules: [] } },
        { defaultLoaders: {} }
      );

      expect(TsconfigPathsPlugin).toHaveBeenCalledWith({
        configFile: '/root/apps/wibble/tsconfig.json',
        extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
        mainFields: ['es2015', 'module', 'main']
      });
    });

    it('should set the resolve aliases', () => {
      const webpackConfig = createWebpackConfig('/root', 'apps/wibble', [
        {
          replace: 'apps/wibble/src/environment.ts',
          with: 'apps/wibble/src/environment.prod.ts'
        }
      ]);

      const config = webpackConfig(
        { resolve: { alias: {} }, module: { rules: [] } },
        { defaultLoaders: {} }
      );

      expect(config.resolve.alias).toEqual({
        '/root/apps/wibble/src/environment.ts':
          '/root/apps/wibble/src/environment.prod.ts'
      });
    });

    it('should set the rules', () => {
      const webpackConfig = createWebpackConfig('/root', 'apps/wibble', []);

      const config = webpackConfig(
        { resolve: { alias: {} }, module: { rules: [] } },
        { defaultLoaders: {} }
      );

      // not much value in checking what they are
      // just check they get added
      expect(config.module.rules.length).toBe(2);
    });
  });

  describe('prepareConfig', () => {
    it('should set the dist and out directories', () => {
      const config = prepareConfig(
        '/root',
        'apps/wibble',
        'dist/apps/wibble',
        [],
        PHASE_PRODUCTION_BUILD
      );

      expect(config).toEqual(
        expect.objectContaining({
          distDir: '../../dist/apps/wibble',
          outdir: '../../dist/apps/wibble'
        })
      );
    });
  });
});
