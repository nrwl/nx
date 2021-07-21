import { mocked } from 'ts-jest/utils';
import { getWebpackConfig, preprocessTypescript } from './preprocessor';
jest.mock('@cypress/webpack-preprocessor', () => {
  return jest.fn(
    () =>
      (...args) =>
        Promise.resolve()
  );
});
jest.mock('tsconfig-paths-webpack-plugin');
import * as wp from '@cypress/webpack-preprocessor';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

const mockWp = mocked(wp);

describe('getWebpackConfig', () => {
  beforeEach(() => {
    (<any>TsConfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );
  });
  it('should load typescript', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json',
      },
    });
    expect(config.module.rules).toContainEqual({
      test: /\.([jt])sx?$/,
      loader: require.resolve('ts-loader'),
      exclude: [/node_modules/],
      options: {
        configFile: './tsconfig.json',
        // https://github.com/TypeStrong/ts-loader/pull/685
        experimentalWatchApi: true,
        transpileOnly: true,
      },
    });
  });

  it('should resolve tsconfig paths', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json',
      },
    });
    expect(
      config.resolve.plugins.some(
        (plugin) => plugin instanceof TsConfigPathsPlugin
      )
    ).toEqual(true);
  });

  it('should resolve relevant extensions', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json',
      },
    });
    expect(config.resolve.extensions).toEqual([
      '.ts',
      '.tsx',
      '.mjs',
      '.js',
      '.jsx',
    ]);
  });

  it('should keep node_modules external', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json',
      },
    });
    const callback = jest.fn();
    config.externals[0](null, '@nestjs/core', callback);
    expect(callback).toHaveBeenCalledWith(null, 'commonjs @nestjs/core');
  });
});

describe('preprocessTypescript', () => {
  it('should work if no customizer is passed', async () => {
    const preprocessor = preprocessTypescript({
      env: {
        tsConfig: './tsconfig.json',
      },
    });
    await preprocessor('arg0');
    expect(wp).toBeCalled();
    expect(
      mockWp.mock.calls[mockWp.mock.calls.length - 1][0].webpackOptions.resolve
        .extensions
    ).toEqual(['.ts', '.tsx', '.mjs', '.js', '.jsx']);
  });

  it('should support customizing the webpack config', async () => {
    const preprocessor = preprocessTypescript(
      {
        env: {
          tsConfig: './tsconfig.json',
        },
      },
      (webpackConfig) => {
        webpackConfig.resolve.extensions.push('.mdx');
        return webpackConfig;
      }
    );
    await preprocessor('arg0');
    expect(wp).toBeCalled();
    expect(
      mockWp.mock.calls[mockWp.mock.calls.length - 1][0].webpackOptions.resolve
        .extensions
    ).toEqual(['.ts', '.tsx', '.mjs', '.js', '.jsx', '.mdx']);
  });
});
