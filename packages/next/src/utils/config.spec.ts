import type { NextConfig } from 'next';
import 'nx/src/utils/testing/mock-fs';
import { composePlugins, createWebpackConfig, NextConfigFn } from './config';
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

  describe('composePlugins', () => {
    it('should combine multiple plugins', async () => {
      const nextConfig: NextConfig = {
        env: {
          original: 'original',
        },
      };
      const a = (config: NextConfig): NextConfig => {
        config.env['a'] = 'a';
        return config;
      };
      const b = (config: NextConfig): NextConfig => {
        config.env['b'] = 'b';
        return config;
      };
      const fn = await composePlugins(a, b);
      const output = await fn(nextConfig)('test', {});

      expect(output).toEqual({
        env: {
          original: 'original',
          a: 'a',
          b: 'b',
        },
      });
    });

    it('should compose plugins that return an async function', async () => {
      const nextConfig: NextConfig = {
        env: {
          original: 'original',
        },
      };
      const a = (config: NextConfig): NextConfig => {
        config.env['a'] = 'a';
        return config;
      };
      const b = (config: NextConfig): NextConfigFn => {
        return (phase: string) => {
          config.env['b'] = phase;
          return config;
        };
      };
      const fn = await composePlugins(a, b);
      const output = await fn(nextConfig)('test', {});

      expect(output).toEqual({
        env: {
          original: 'original',
          a: 'a',
          b: 'test',
        },
      });
    });
  });
});
