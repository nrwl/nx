import * as mergeWebpack from 'webpack-merge';
// TODO @FrozenPandaz we should remove the following imports
import { getBrowserConfig } from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser';
import { getCommonConfig } from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/common';
import { getStylesConfig } from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/styles';
import { Configuration } from 'webpack';
import { LoggerApi } from '@angular-devkit/core/src/logger';
import { resolve } from 'path';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { convertBuildOptions } from './normalize';
import { readTsConfig } from '@nrwl/workspace';
import { getBaseWebpackPartial } from './config';
import { IndexHtmlWebpackPlugin } from '@angular-devkit/build-angular/src/angular-cli-files/plugins/index-html-webpack-plugin';
import { ScriptTarget } from 'typescript';

export function getWebConfig(
  root,
  sourceRoot,
  options: WebBuildBuilderOptions,
  logger: LoggerApi,
  overrideScriptTarget?: ScriptTarget
) {
  const tsConfig = readTsConfig(options.tsConfig);

  if (
    options.differentialLoading &&
    !(
      tsConfig.options.target !== ScriptTarget.ES5 &&
      tsConfig.options.target !== ScriptTarget.ES3
    )
  ) {
    const message = `Differential Loading is only necessary for targeting ES2015 and above. To target ES2015, set the target field in your tsconfig.json to 'es2015'`;
    logger.fatal(message);
    throw new Error(message);
  }

  const supportES2015 = options.differentialLoading
    ? overrideScriptTarget === ScriptTarget.ES2015
    : tsConfig.options.target !== ScriptTarget.ES5 &&
      tsConfig.options.target !== ScriptTarget.ES3;
  const wco: any = {
    root,
    projectRoot: resolve(root, sourceRoot),
    buildOptions: convertBuildOptions(options, overrideScriptTarget),
    supportES2015,
    logger,
    tsConfig,
    tsConfigPath: options.tsConfig
  };
  return mergeWebpack([
    _getBaseWebpackPartial(options),
    getPolyfillsPartial(options, overrideScriptTarget),
    getStylesPartial(wco),
    getCommonPartial(wco),
    getBrowserPartial(wco)
  ]);
}

function getBrowserPartial(wco: any) {
  const config = getBrowserConfig(wco);
  if (wco.buildOptions.differentialLoading) {
    config.plugins = config.plugins.filter(
      plugin => !(plugin instanceof IndexHtmlWebpackPlugin)
    );
  }
  return config;
}

function _getBaseWebpackPartial(options: WebBuildBuilderOptions) {
  let partial = getBaseWebpackPartial(options);
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

function getStylesPartial(wco: any): Configuration {
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

function getPolyfillsPartial(
  options: WebBuildBuilderOptions,
  overrideScriptTarget: ScriptTarget
): Configuration {
  const config = {
    entry: {} as { [key: string]: string[] }
  };

  if (
    options.polyfills &&
    options.differentialLoading &&
    overrideScriptTarget === ScriptTarget.ES2015
  ) {
    config.entry.polyfills = [
      require.resolve(
        '@angular-devkit/build-angular/src/angular-cli-files/models/safari-nomodule.js'
      ),
      ...(options.polyfills ? [options.polyfills] : [])
    ];
  } else if (
    options.es2015Polyfills &&
    options.differentialLoading &&
    overrideScriptTarget !== ScriptTarget.ES2015
  ) {
    config.entry.polyfills = [
      options.es2015Polyfills,
      ...(options.polyfills ? [options.polyfills] : [])
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
