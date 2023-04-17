import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { resolve } from 'path';

/**
 * @deprecated use bundler: 'metro' instead, will be removed in 16.0.0
 * This function add additional rules to expo's webpack config to make expo web working
 */
export async function withNxWebpack(config) {
  // add additional rule to load files under libs
  const rules = config.module.rules[1]?.oneOf;
  if (rules) {
    rules.push({
      test: /\.(mjs|[jt]sx?)$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve('@nx/webpack/src/utils/web-babel-loader.js'),
        options: {
          presets: [
            [
              '@nx/react/babel',
              {
                runtime: 'automatic',
              },
            ],
          ],
        },
      },
    });
  }

  if (!config.resolve) {
    config.resolve = {};
  }
  if (!config.resolve.plugins) {
    config.resolve.plugins = [];
  }

  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  const tsConfigPath = resolve('tsconfig.json');

  config.resolve.plugins.push(
    new TsconfigPathsPlugin({
      configFile: tsConfigPath,
      extensions,
    })
  );

  config.resolve.symlinks = true;
  return config;
}
