import * as mergeWebpack from 'webpack-merge';
// TODO @FrozenPandaz we should remove the following imports
import { getBrowserConfig } from './build-angular/angular-cli-files/models/webpack-configs/browser';
import { getCommonConfig } from './build-angular/angular-cli-files/models/webpack-configs/common';
import { getStylesConfig } from './build-angular/angular-cli-files/models/webpack-configs/styles';
import { Configuration } from 'webpack';
import { LoggerApi } from '@angular-devkit/core/src/logger';
import { basename, resolve } from 'path';
import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { convertBuildOptions } from './normalize';
import { readTsConfig } from '@nrwl/workspace';
import { getBaseWebpackPartial } from './config';
import { IndexHtmlWebpackPlugin } from './build-angular/angular-cli-files/plugins/index-html-webpack-plugin';
import { generateEntryPoints } from './build-angular/angular-cli-files/utilities/package-chunk-sort';
import { ScriptTarget } from 'typescript';

export function getWebConfig(
  root,
  sourceRoot,
  options: WebBuildBuilderOptions,
  logger: LoggerApi,
  esm?: boolean,
  isScriptOptimizeOn?: boolean
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
    logger,
    tsConfig,
    tsConfigPath: options.tsConfig
  };
  return mergeWebpack([
    _getBaseWebpackPartial(options, esm, isScriptOptimizeOn),
    getPolyfillsPartial(options, esm, isScriptOptimizeOn),
    getStylesPartial(wco),
    getCommonPartial(wco),
    getBrowserPartial(wco, options, isScriptOptimizeOn)
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
      baseHref
    } = options;

    config.plugins.push(
      new IndexHtmlWebpackPlugin({
        input: resolve(wco.root, index),
        output: basename(index),
        baseHref,
        entrypoints: generateEntryPoints({ scripts, styles }),
        deployUrl: deployUrl,
        sri: subresourceIntegrity,
        noModuleEntrypoints: ['polyfills-es5']
      })
    );
  }

  return config;
}

function _getBaseWebpackPartial(
  options: WebBuildBuilderOptions,
  esm: boolean,
  isScriptOptimizeOn: boolean
) {
  let partial = getBaseWebpackPartial(options, esm, isScriptOptimizeOn);
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
  esm: boolean,
  isScriptOptimizeOn: boolean
): Configuration {
  const config = {
    entry: {} as { [key: string]: string[] }
  };

  if (options.polyfills && esm && isScriptOptimizeOn) {
    // Safari 10.1 supports <script type="module"> but not <script nomodule>.
    // Need to patch it up so the browser doesn't load both sets.
    config.entry.polyfills = [
      require.resolve(
        '@nrwl/web/src/utils/build-angular/angular-cli-files/models/safari-nomodule.js'
      ),
      ...(options.polyfills ? [options.polyfills] : [])
    ];
  } else if (options.es2015Polyfills && !esm && isScriptOptimizeOn) {
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
