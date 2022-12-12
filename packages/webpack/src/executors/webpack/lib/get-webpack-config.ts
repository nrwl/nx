import * as path from 'path';
import { posix, resolve } from 'path';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { getHashDigest, interpolateName } from 'loader-utils';
import type { Configuration } from 'webpack';

import { NormalizedWebpackExecutorOptions } from '../schema';

// TODO(jack): These should be inlined in a single function so it is easier to understand
import { getBaseWebpackPartial } from '../../../utils/config';
import { getBrowserConfig } from '../../../utils/webpack/partials/browser';
import { getCommonConfig } from '../../../utils/webpack/partials/common';
import { getStylesConfig } from '../../../utils/webpack/partials/styles';
import { ExecutorContext } from '@nrwl/devkit';
import MiniCssExtractPlugin = require('mini-css-extract-plugin');
import webpackMerge = require('webpack-merge');
import postcssImports = require('postcss-import');

// PostCSS options depend on the webpack loader, but we need to set the `config` path as a string due to this check:
// https://github.com/webpack-contrib/postcss-loader/blob/0d342b1/src/utils.js#L36
interface PostcssOptions {
  (loader: any): any;

  config?: string;
}

interface GetWebpackConfigOverrides {
  root: string;
  sourceRoot: string;
  configuration?: string;
}

export function getWebpackConfig(
  context: ExecutorContext,
  options: NormalizedWebpackExecutorOptions,
  isScriptOptimizeOn?: boolean,
  overrides?: GetWebpackConfigOverrides
): Configuration {
  const tsConfig = readTsConfig(options.tsConfig);
  const workspaceRoot = context.root;

  let sourceRoot: string;
  let projectRoot: string;
  if (overrides) {
    projectRoot = overrides.root;
    sourceRoot = overrides.sourceRoot;
  } else {
    const project = context.workspace.projects[context.projectName];
    projectRoot = project.root;
    sourceRoot = project.sourceRoot;
  }

  const wco: any = {
    root: workspaceRoot,
    projectRoot: resolve(workspaceRoot, projectRoot),
    sourceRoot: resolve(workspaceRoot, sourceRoot),
    buildOptions: convertBuildOptions(options),
    console,
    tsConfig,
    tsConfigPath: options.tsConfig,
  };
  // TODO(jack): Replace merge behavior with an inlined config so it is easier to understand.
  return webpackMerge.merge([
    _getBaseWebpackPartial(
      context,
      options,
      isScriptOptimizeOn,
      tsConfig.options.emitDecoratorMetadata,
      overrides
    ),
    options.target === 'web'
      ? getPolyfillsPartial(options.polyfills, isScriptOptimizeOn)
      : {},
    options.target === 'web'
      ? getStylesPartial(
          wco.root,
          wco.projectRoot,
          wco.buildOptions,
          options.extractCss,
          options.postcssConfig
        )
      : {},
    getCommonPartial(wco),
    options.target === 'web' ? getBrowserConfig(wco) : {},
  ]);
}

function _getBaseWebpackPartial(
  context: ExecutorContext,
  options: NormalizedWebpackExecutorOptions,
  isScriptOptimizeOn: boolean,
  emitDecoratorMetadata: boolean,
  overrides?: GetWebpackConfigOverrides
) {
  let partial = getBaseWebpackPartial(
    options,
    {
      isScriptOptimizeOn,
      emitDecoratorMetadata,
      configuration: overrides?.configuration ?? context.configurationName,
    },
    context
  );
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
  isScriptOptimizeOn: boolean
): Configuration {
  const config = {
    entry: {} as { [key: string]: string[] },
  };

  if (polyfills && isScriptOptimizeOn) {
    // Safari 10.1 supports <script type="module"> but not <script nomodule>.
    // Need to patch it up so the browser doesn't load both sets.
    config.entry.polyfills = [
      require.resolve('@nrwl/webpack/src/utils/webpack/safari-nomodule.js'),
      ...(polyfills ? [polyfills] : []),
    ];
  } else {
    if (polyfills) {
      config.entry.polyfills = [polyfills];
    }
  }

  return config;
}

export function getCSSModuleLocalIdent(
  context,
  localIdentName,
  localName,
  options
) {
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

export function convertBuildOptions(
  buildOptions: NormalizedWebpackExecutorOptions
): any {
  const options = buildOptions as any;
  return {
    ...options,
    buildOptimizer: options.optimization,
    forkTypeChecker: false,
    lazyModules: [] as string[],
  };
}
