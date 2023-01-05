import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { resolve } from 'path';

/**
 * This function add addtional rules to expo's webpack config to make expo web working
 */
export async function withNxWebpack(config) {
  // add additional rule to load files under libs
  const rules = config.module.rules[1]?.oneOf;
  if (rules) {
    rules.push({
      test: /\.(mjs|[jt]sx?)$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve('@nrwl/webpack/src/utils/web-babel-loader.js'),
        options: {
          presets: [
            [
              '@nrwl/react/babel',
              {
                runtime: 'automatic',
              },
            ],
          ],
        },
      },
    });
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
