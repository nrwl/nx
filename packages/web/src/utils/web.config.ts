import * as mergeWebpack from 'webpack-merge';
// TODO @FrozenPandaz we should remove the following imports
import { getBrowserConfig } from './third-party/cli-files/models/webpack-configs/browser';
import { getCommonConfig } from './third-party/cli-files/models/webpack-configs/common';
import { getStylesConfig } from './third-party/cli-files/models/webpack-configs/styles';
import { Configuration } from 'webpack';
import { basename, resolve, posix } from 'path';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { convertBuildOptions } from './normalize';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { getBaseWebpackPartial } from './config';
import { IndexHtmlWebpackPlugin } from './third-party/cli-files/plugins/index-html-webpack-plugin';
import { generateEntryPoints } from './third-party/cli-files/utilities/package-chunk-sort';
import { ScriptTarget } from 'typescript';
import { getHashDigest, interpolateName } from 'loader-utils';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

export function getWebConfig(
  root,
  sourceRoot,
  options: WebBuildBuilderOptions,
  esm?: boolean,
  isScriptOptimizeOn?: boolean,
  configuration?: string
) {
  const tsConfig = readTsConfig(options.tsConfig);

  if (isScriptOptimizeOn) {
    // Angular CLI uses an environment variable (NG_BUILD_DIFFERENTIAL_FULL)
    // to determine whether to use the scriptTargetOverride
    // or the tsConfig target
    // We want to force the target if overriden
    tsConfig.options.target = ScriptTarget.ES5;
  }

  const wco: any = {
    root,
    projectRoot: resolve(root, sourceRoot),
    buildOptions: convertBuildOptions(options),
    esm,
    console,
    tsConfig,
    tsConfigPath: options.tsConfig,
  };
  return mergeWebpack([
    _getBaseWebpackPartial(
      options,
      esm,
      isScriptOptimizeOn,
      tsConfig.options.emitDecoratorMetadata,
      configuration
    ),
    getPolyfillsPartial(options, esm, isScriptOptimizeOn),
    getStylesPartial(wco, options),
    getCommonPartial(wco),
    getBrowserPartial(wco, options, isScriptOptimizeOn),
  ]);
}

function getBrowserPartial(
  wco: any,
  options: WebBuildBuilderOptions,
  isScriptOptimizeOn: boolean
) {
  const config = getBrowserConfig(wco);

  if (!isScriptOptimizeOn) {
    const {
      deployUrl,
      subresourceIntegrity,
      scripts = [],
      styles = [],
      index,
      baseHref,
    } = options;

    config.plugins.push(
      new IndexHtmlWebpackPlugin({
        input: resolve(wco.root, index),
        output: basename(index),
        baseHref,
        entrypoints: generateEntryPoints({ scripts, styles }),
        deployUrl,
        sri: subresourceIntegrity,
        noModuleEntrypoints: ['polyfills-es5'],
      })
    );
  }

  return config;
}

function _getBaseWebpackPartial(
  options: WebBuildBuilderOptions,
  esm: boolean,
  isScriptOptimizeOn: boolean,
  emitDecoratorMetadata: boolean,
  configuration?: string
) {
  let partial = getBaseWebpackPartial(
    options,
    esm,
    isScriptOptimizeOn,
    emitDecoratorMetadata,
    configuration
  );
  delete partial.resolve.mainFields;
  return partial;
}

function getCommonPartial(wco: any): Configuration {
  const commonConfig: Configuration = <Configuration>getCommonConfig(wco);
  delete commonConfig.entry;
  // delete commonConfig.devtool;
  delete commonConfig.resolve.modules;
  delete commonConfig.resolve.extensions;
  delete commonConfig.output.path;
  delete commonConfig.module;
  return commonConfig;
}

function getStylesPartial(
  wco: any,
  options: WebBuildBuilderOptions
): Configuration {
  const partial = getStylesConfig(wco);
  const rules = partial.module.rules.map((rule) => {
    if (!Array.isArray(rule.use)) {
      return rule;
    }
    rule.use = rule.use.map((loaderConfig) => {
      if (
        typeof loaderConfig === 'object' &&
        loaderConfig.loader === require.resolve('raw-loader')
      ) {
        return {
          loader: require.resolve('style-loader'),
        };
      }
      return loaderConfig;
    });
    return rule;
  });

  const loaderModulesOptions = {
    modules: {
      mode: 'local',
      getLocalIdent: getCSSModuleLocalIdent,
    },
    importLoaders: 1,
  };

  partial.module.rules = [
    {
      test: /\.css$|\.scss$|\.sass$|\.less$|\.styl$/,
      oneOf: [
        {
          test: /\.module\.css$/,
          use: [
            {
              loader: options.extractCss
                ? MiniCssExtractPlugin.loader
                : require.resolve('style-loader'),
            },
            {
              loader: require.resolve('css-loader'),
              options: loaderModulesOptions,
            },
          ],
        },
        {
          test: /\.module\.(scss|sass)$/,
          use: [
            {
              loader: options.extractCss
                ? MiniCssExtractPlugin.loader
                : require.resolve('style-loader'),
            },
            {
              loader: require.resolve('css-loader'),
              options: loaderModulesOptions,
            },
            { loader: require.resolve('sass-loader') },
          ],
        },
        {
          test: /\.module\.less$/,
          use: [
            {
              loader: options.extractCss
                ? MiniCssExtractPlugin.loader
                : require.resolve('style-loader'),
            },
            {
              loader: require.resolve('css-loader'),
              options: loaderModulesOptions,
            },
            { loader: require.resolve('less-loader') },
          ],
        },
        {
          test: /\.module\.styl$/,
          use: [
            {
              loader: options.extractCss
                ? MiniCssExtractPlugin.loader
                : require.resolve('style-loader'),
            },
            {
              loader: require.resolve('css-loader'),
              options: loaderModulesOptions,
            },
            { loader: require.resolve('stylus-loader') },
          ],
        },
        ...rules,
      ],
    },
  ];
  return partial;
}

function getPolyfillsPartial(
  options: WebBuildBuilderOptions,
  esm: boolean,
  isScriptOptimizeOn: boolean
): Configuration {
  const config = {
    entry: {} as { [key: string]: string[] },
  };

  if (options.polyfills && esm && isScriptOptimizeOn) {
    // Safari 10.1 supports <script type="module"> but not <script nomodule>.
    // Need to patch it up so the browser doesn't load both sets.
    config.entry.polyfills = [
      require.resolve(
        '@nrwl/web/src/utils/third-party/cli-files/models/safari-nomodule.js'
      ),
      ...(options.polyfills ? [options.polyfills] : []),
    ];
  } else if (options.es2015Polyfills && !esm && isScriptOptimizeOn) {
    config.entry.polyfills = [
      options.es2015Polyfills,
      ...(options.polyfills ? [options.polyfills] : []),
    ];
  } else {
    if (options.polyfills) {
      config.entry.polyfills = [options.polyfills];
    }
    if (options.es2015Polyfills) {
      config.entry['polyfills-es5'] = [options.es2015Polyfills];
    }
  }

  return config;
}

function getCSSModuleLocalIdent(context, localIdentName, localName, options) {
  // Use the filename or folder name, based on some uses the index.js / index.module.(css|scss|sass) project style
  const fileNameOrFolder = context.resourcePath.match(
    /index\.module\.(css|scss|sass|styl)$/
  )
    ? '[folder]'
    : '[name]';
  // Create a hash based on a the file location and class name. Will be unique across a project, and close to globally unique.
  const hash = getHashDigest(
    posix.relative(context.rootContext, context.resourcePath) + localName,
    'md5',
    'base64',
    5
  );
  // Use loaderUtils to find the file or folder name
  const className = interpolateName(
    context,
    fileNameOrFolder + '_' + localName + '__' + hash,
    options
  );
  // Remove the .module that appears in every classname when based on the file and replace all "." with "_".
  return className.replace('.module_', '_').replace(/\./g, '_');
}
