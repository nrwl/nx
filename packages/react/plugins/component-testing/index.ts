import { startDevServer } from '@cypress/webpack-dev-server';
import { nxBaseCypressPreset } from '@nrwl/cypress/plugins/cypress-preset';
import { getCSSModuleLocalIdent } from '@nrwl/web/src/utils/web.config';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';

/**
 * nx Component Testing Preset for Cypress
 * @description
 * this preset contains the base configuration
 * for your component tests that nx recommends.
 * including a devServer that supports nx workspaces.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   component: {
 *     ...nxComponentTestingPreset(__dirname)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used to construct the output paths for videos and screenshots
 */
export function nxComponentTestingPreset(pathToConfig: string) {
  return {
    ...nxBaseCypressPreset(pathToConfig),
    devServer: componentDevServer(),
  };
}

export function componentDevServer(
  tsConfigPath = 'tsconfig.cy.json',
  compiler: 'swc' | 'babel' = 'babel'
): (
  cypressDevServerConfig,
  devServerConfig
) => ReturnType<typeof startDevServer> {
  const webpackConfig = buildBaseWebpackConfig({ tsConfigPath, compiler });

  return (cypressDevServerConfig, devServerConfig) =>
    startDevServer({
      options: cypressDevServerConfig,
      webpackConfig,
    });
}

// TODO(caleb): use the webpack utils to build the config
//  can't seem to get css modules to play nice when using it 🤔
function buildBaseWebpackConfig({
  tsConfigPath = 'tsconfig.cy.json',
  compiler = 'babel',
}: {
  tsConfigPath: string;
  compiler: 'swc' | 'babel';
}): Configuration {
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  const config: Configuration = {
    target: 'web',
    resolve: {
      extensions,
      plugins: [
        new TsconfigPathsPlugin({
          configFile: tsConfigPath,
          extensions,
        }) as never,
      ],
    },
    mode: 'development',
    devtool: false,
    output: {
      publicPath: '/',
      chunkFilename: '[name].bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.(bmp|png|jpe?g|gif|webp|avif)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10_000, // 10 kB
            },
          },
        },
        CSS_MODULES_LOADER,
      ],
    },
  };

  if (compiler === 'swc') {
    config.module.rules.push({
      test: /\.([jt])sx?$/,
      loader: require.resolve('swc-loader'),
      exclude: /node_modules/,
      options: {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
          loose: true,
        },
      },
    });
  }

  if (compiler === 'babel') {
    config.module.rules.push({
      test: /\.(js|jsx|mjs|ts|tsx)$/,
      loader: require.resolve('babel-loader'),
      options: {
        presets: [`@nrwl/react/babel`],
        rootMode: 'upward',
        babelrc: true,
      },
    });
  }
  return config;
}

const loaderModulesOptions = {
  modules: {
    mode: 'local',
    getLocalIdent: getCSSModuleLocalIdent,
  },
  importLoaders: 1,
};

const commonLoaders = [
  {
    loader: require.resolve('style-loader'),
  },
  {
    loader: require.resolve('css-loader'),
    options: loaderModulesOptions,
  },
];

const CSS_MODULES_LOADER = {
  test: /\.css$|\.scss$|\.sass$|\.less$|\.styl$/,
  oneOf: [
    {
      test: /\.module\.css$/,
      use: commonLoaders,
    },
    {
      test: /\.module\.(scss|sass)$/,
      use: [
        ...commonLoaders,
        {
          loader: require.resolve('sass-loader'),
          options: {
            implementation: require('sass'),
            sassOptions: {
              fiber: false,
              precision: 8,
            },
          },
        },
      ],
    },
    {
      test: /\.module\.less$/,
      use: [
        ...commonLoaders,
        {
          loader: require.resolve('less-loader'),
        },
      ],
    },
    {
      test: /\.module\.styl$/,
      use: [
        ...commonLoaders,
        {
          loader: require.resolve('stylus-loader'),
        },
      ],
    },
  ],
};
