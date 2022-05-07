import * as path from 'path';
import { posix, resolve } from 'path';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { ScriptTarget } from 'typescript';
import { getHashDigest, interpolateName } from 'loader-utils';
import { Configuration } from 'webpack';

import { WebWebpackExecutorOptions } from '../executors/webpack/webpack.impl';
import { convertBuildOptions } from './normalize';

// TODO(jack): These should be inlined in a single function so it is easier to understand
import { getBaseWebpackPartial } from './config';
import { getBrowserConfig } from './webpack/partials/browser';
import { getCommonConfig } from './webpack/partials/common';
import { getStylesConfig } from './webpack/partials/styles';
import MiniCssExtractPlugin = require('mini-css-extract-plugin');
import webpackMerge = require('webpack-merge');
import postcssImports = require('postcss-import');

// PostCSS options depend on the webpack loader, but we need to set the `config` path as a string due to this check:
// https://github.com/webpack-contrib/postcss-loader/blob/0d342b1/src/utils.js#L36
interface PostcssOptions {
  (loader: any): any;

  config?: string;
}

export function getWebConfig(
  workspaceRoot,
  projectRoot,
  sourceRoot,
  options: WebWebpackExecutorOptions,
  esm?: boolean,
  isScriptOptimizeOn?: boolean,
  configuration?: string
) {
  const tsConfig = readTsConfig(options.tsConfig);

  if (isScriptOptimizeOn) {
    // Angular CLI uses an environment variable (NG_BUILD_DIFFERENTIAL_FULL)
    // to determine whether to use the scriptTargetOverride
    // or the tsConfig target
    // We want to force the target if overridden
    tsConfig.options.target = ScriptTarget.ES5;
  }
  const wco: any = {
    root: workspaceRoot,
    projectRoot: resolve(workspaceRoot, projectRoot),
    sourceRoot: resolve(workspaceRoot, sourceRoot),
    buildOptions: convertBuildOptions(options),
    esm,
    console,
    tsConfig,
    tsConfigPath: options.tsConfig,
  };
  // TODO(jack): Replace merge behavior with an inlined config so it is easier to understand.
  return webpackMerge.merge([
    _getBaseWebpackPartial(
      options,
      esm,
      isScriptOptimizeOn,
      tsConfig.options.emitDecoratorMetadata,
      configuration
    ),
    getPolyfillsPartial(
      options.polyfills,
      options.es2015Polyfills,
      esm,
      isScriptOptimizeOn
    ),
    getStylesPartial(
      wco.root,
      wco.projectRoot,
      wco.buildOptions,
      options.extractCss,
      options.postcssConfig
    ),
    getCommonPartial(wco),
    getBrowserConfig(wco),
  ]);
}

function _getBaseWebpackPartial(
  options: WebWebpackExecutorOptions,
  esm: boolean,
  isScriptOptimizeOn: boolean,
  emitDecoratorMetadata: boolean,
  configuration?: string
) {
  let partial = getBaseWebpackPartial(options, {
    esm,
    isScriptOptimizeOn,
    emitDecoratorMetadata,
    configuration,
  });
  delete partial.resolve.mainFields;
  return partial;
}

function getCommonPartial(wco: any): Configuration {
  const commonConfig: Configuration = <Configuration>getCommonConfig(wco);
  delete commonConfig.entry;
  delete commonConfig.resolve.modules;
  delete commonConfig.resolve.extensions;
  delete commonConfig.output.path;
  delete commonConfig.module;
  return commonConfig;
}

export function getStylesPartial(
  workspaceRoot: string,
  projectRoot: string,
  options: any,
  extractCss: boolean,
  postcssConfig?: string
): Configuration {
  const includePaths: string[] = [];

  if (options?.stylePreprocessorOptions?.includePaths?.length > 0) {
    options.stylePreprocessorOptions.includePaths.forEach(
      (includePath: string) =>
        includePaths.push(path.resolve(workspaceRoot, includePath))
    );
  }

  const partial = getStylesConfig(workspaceRoot, options, includePaths);
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
  const postcssOptions: PostcssOptions = () => ({
    plugins: [
      postcssImports({
        addModulesDirectories: includePaths,
        resolve: (url: string) => (url.startsWith('~') ? url.slice(1) : url),
      }),
    ],
  });
  // If a path to postcssConfig is passed in, set it for app and all libs, otherwise
  // use automatic detection.
  if (typeof postcssConfig === 'string') {
    postcssOptions.config = path.join(workspaceRoot, postcssConfig);
  }

  const commonLoaders = [
    {
      loader: extractCss
        ? MiniCssExtractPlugin.loader
        : require.resolve('style-loader'),
    },
    {
      loader: require.resolve('css-loader'),
      options: loaderModulesOptions,
    },
    {
      loader: require.resolve('postcss-loader'),
      options: {
        implementation: require('postcss'),
        postcssOptions: postcssOptions,
      },
    },
  ];

  partial.module.rules = [
    {
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
                  includePaths,
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
              options: {
                lessOptions: {
                  paths: includePaths,
                },
              },
            },
          ],
        },
        {
          test: /\.module\.styl$/,
          use: [
            ...commonLoaders,
            {
              loader: require.resolve('stylus-loader'),
              options: {
                stylusOptions: {
                  include: includePaths,
                },
              },
            },
          ],
        },
        ...rules,
      ],
    },
  ];
  return partial;
}

export function getPolyfillsPartial(
  polyfills: string,
  es2015Polyfills: string,
  esm: boolean,
  isScriptOptimizeOn: boolean
): Configuration {
  const config = {
    entry: {} as { [key: string]: string[] },
  };

  if (polyfills && esm && isScriptOptimizeOn) {
    // Safari 10.1 supports <script type="module"> but not <script nomodule>.
    // Need to patch it up so the browser doesn't load both sets.
    config.entry.polyfills = [
      require.resolve('@nrwl/web/src/utils/webpack/safari-nomodule.js'),
      ...(polyfills ? [polyfills] : []),
    ];
  } else if (es2015Polyfills && !esm && isScriptOptimizeOn) {
    config.entry.polyfills = [
      es2015Polyfills,
      ...(polyfills ? [polyfills] : []),
    ];
  } else {
    if (polyfills) {
      config.entry.polyfills = [polyfills];
    }
    if (es2015Polyfills) {
      config.entry['polyfills-es5'] = [es2015Polyfills];
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
    `${fileNameOrFolder}_${localName}__${hash}`,
    options
  );
  // Remove the .module that appears in every classname when based on the file and replace all "." with "_".
  return className.replace('.module_', '_').replace(/\./g, '_');
}
