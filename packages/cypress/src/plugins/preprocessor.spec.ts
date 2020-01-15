import { getWebpackConfig } from './preprocessor';
jest.mock('tsconfig-paths-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

describe('getWebpackConfig', () => {
  beforeEach(() => {
    (<any>TsConfigPathsPlugin).mockImplementation(
      function MockPathsPlugin() {}
    );
  });
  it('should load typescript', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json'
      }
    });
    expect(config.module.rules).toContainEqual({
      test: /\.(j|t)sx?$/,
      loader: 'ts-loader',
      exclude: [/node_modules/],
      options: {
        configFile: './tsconfig.json',
        // https://github.com/TypeStrong/ts-loader/pull/685
        experimentalWatchApi: true,
        transpileOnly: true
      }
    });
  });

  it('should resolve tsconfig paths', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json'
      }
    });
    expect(
      config.resolve.plugins.some(
        plugin => plugin instanceof TsConfigPathsPlugin
      )
    ).toEqual(true);
  });

  it('should resolve relevant extensions', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json'
      }
    });
    expect(config.resolve.extensions).toEqual([
      '.ts',
      '.tsx',
      '.mjs',
      '.js',
      '.jsx'
    ]);
  });

  it('should keep node_modules external', () => {
    const config = getWebpackConfig({
      env: {
        tsConfig: './tsconfig.json'
      }
    });
    const callback = jest.fn();
    config.externals[0](null, '@nestjs/core', callback);
    expect(callback).toHaveBeenCalledWith(null, 'commonjs @nestjs/core');
  });
});
