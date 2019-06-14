import { getWebpackConfig } from './preprocessor';
jest.mock('tsconfig-paths-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

describe('getWebpackConfig', () => {
  beforeEach(() => {
    (<any>TsConfigPathsPlugin).mockImplementation(class MockPathsPlugin {});
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
      options: {
        configFile: './tsconfig.json',
        // https://github.com/TypeStrong/ts-loader/pull/685
        experimentalWatchApi: true
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
});
