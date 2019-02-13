import * as mergeWebpack from 'webpack-merge';

import { WebBuildBuilderOptions } from '../../web/build/web-build.builder';
import { getBaseWebpackPartial } from './config';
import {
  getBrowserConfig,
  getStylesConfig,
  getCommonConfig
} from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs';
import { convertBuildOptions } from '../normalize';
import { Configuration } from 'webpack';
import { Logger } from '@angular-devkit/core/src/logger';
import { readTsConfig } from '../typescript';
import { resolve } from 'path';
import {
  WebpackConfigOptions,
  BuildOptions
} from '@angular-devkit/build-angular/src/angular-cli-files/models/build-options';
import typescript = require('typescript');

export function getWebConfig(options: WebBuildBuilderOptions, logger: Logger) {
  const tsConfig = readTsConfig(options.tsConfig);
  const supportES2015 =
    tsConfig.options.target !== typescript.ScriptTarget.ES5 &&
    tsConfig.options.target !== typescript.ScriptTarget.ES3;
  const wco: WebpackConfigOptions<BuildOptions> = {
    root: options.root,
    projectRoot: resolve(options.root, options.sourceRoot),
    buildOptions: convertBuildOptions(options),
    supportES2015,
    logger,
    tsConfig,
    tsConfigPath: options.tsConfig
  };
  return mergeWebpack([
    _getBaseWebpackPartial(options),
    options.polyfills ? getPolyfillsPartial(options) : {},
    options.es2015Polyfills ? getEs2015PolyfillsPartial(options) : {},
    getStylesPartial(wco),
    getCommonPartial(wco),
    getBrowserConfig(wco)
  ]);
}
function _getBaseWebpackPartial(options: WebBuildBuilderOptions) {
  let partial = getBaseWebpackPartial(options);
  delete partial.resolve.mainFields;
  return partial;
}

function getCommonPartial(
  wco: WebpackConfigOptions<BuildOptions>
): Configuration {
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
  wco: WebpackConfigOptions<BuildOptions>
): Configuration {
  const partial = getStylesConfig(wco);
  partial.module.rules = partial.module.rules.map(rule => {
    if (!Array.isArray(rule.use)) {
      return rule;
    }
    rule.use = rule.use.map(loaderConfig => {
      if (
        typeof loaderConfig === 'object' &&
        loaderConfig.loader === 'raw-loader'
      ) {
        return {
          loader: 'style-loader'
        };
      }
      return loaderConfig;
    });
    return rule;
  });
  return partial;
}

function getPolyfillsPartial(options: WebBuildBuilderOptions): Configuration {
  return {
    entry: {
      polyfills: [options.polyfills]
    }
  };
}

function getEs2015PolyfillsPartial(
  options: WebBuildBuilderOptions
): Configuration {
  return {
    entry: {
      ['es2015-polyfills']: [options.es2015Polyfills]
    }
  };
}
