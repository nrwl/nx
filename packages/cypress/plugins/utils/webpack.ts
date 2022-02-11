import { Configuration } from 'webpack';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { posix } from 'path';
import { getHashDigest, interpolateName } from 'loader-utils';

function getCSSModuleLocalIdent(context, localIdentName, localName, options) {
  // Use the filename or folder name,
  // based on some uses the index.js / index.module.(css|scss|sass) project style
  const fileNameOrFolder = context.resourcePath.match(
    /index\.module\.(css|scss|sass|styl)$/
  )
    ? '[folder]'
    : '[name]';
  // Create a hash based on the file location and class name.
  // Will be unique across a project, and close to globally unique.
  const hash = getHashDigest(
    posix.relative(context.rootContext, context.resourcePath) + localName,
    'md5',
    'base64',
    5
  );
  // Use loaderUtils to find the file or folder name
  const className = interpolateName(
    context,
    `${fileNameOrFolder}_${localName}__${hash}`,
    options
  );
  // Remove the .module that appears in every classname
  // when based on the file and replace all "." with "_".
  return className.replace('.module_', '_').replace(/\./g, '_');
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

export const CSS_MODULES_LOADER = {
  // TODO(caleb): does css outside of css-in-js work?
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

export function getLibLoaders(
  compiler: 'babel' | 'swc',
  preset: 'react' | 'next'
) {
  if (compiler === 'swc') {
    return {
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
    };
  }

  return {
    test: /\.(js|jsx|mjs|ts|tsx)$/,
    loader: require.resolve('babel-loader'),
    options: {
      presets: [`@nrwl/${preset}/babel`],
      rootMode: 'upward',
      babelrc: true,
    },
  };
}

export function buildBaseWebpackConfig({
  tsConfigPath = 'tsconfig.cy.json',
  compiler = 'babel',
  preset = 'react',
}: {
  tsConfigPath: string;
  compiler: 'swc' | 'babel';
  preset: 'react' | 'next';
}): Configuration {
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  return {
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
        getLibLoaders(compiler, preset),
      ],
    },
  };
}
