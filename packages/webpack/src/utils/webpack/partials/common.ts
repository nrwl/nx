import { basename, resolve } from 'path';
import type { Compiler, Configuration } from 'webpack';
import { ProgressPlugin, sources } from 'webpack';

import { normalizeExtraEntryPoints } from '../normalize-entry';
import { ScriptsWebpackPlugin } from '../plugins/scripts-webpack-plugin';
import { getOutputHashFormat } from '../../hash-format';
import { findAllNodeModules, findUp } from '../../fs';
import type { CreateWebpackConfigOptions } from '../../models';

export function getCommonConfig(
  wco: CreateWebpackConfigOptions
): Configuration {
  const { root, projectRoot, sourceRoot, buildOptions } = wco;

  let stylesOptimization: boolean;
  let scriptsOptimization: boolean;
  if (typeof buildOptions.optimization === 'object') {
    scriptsOptimization = buildOptions.optimization.scripts;
    stylesOptimization = buildOptions.optimization.styles;
  } else {
    scriptsOptimization = stylesOptimization = !!buildOptions.optimization;
  }

  const nodeModules = findUp('node_modules', projectRoot);
  if (!nodeModules) {
    throw new Error('Cannot locate node_modules directory.');
  }

  // tslint:disable-next-line:no-any
  const extraPlugins: any[] = [];
  const entryPoints: { [key: string]: string[] } = {};

  if (buildOptions.main) {
    entryPoints['main'] = [resolve(root, buildOptions.main)];
  }

  if (buildOptions.polyfills) {
    entryPoints['polyfills'] = [
      ...(entryPoints['polyfills'] || []),
      resolve(root, buildOptions.polyfills),
    ];
  }

  // determine hashing format
  const hashFormat = getOutputHashFormat(buildOptions.outputHashing || 'none');

  // process global scripts
  const globalScriptsByBundleName = normalizeExtraEntryPoints(
    buildOptions.scripts || [],
    'scripts'
  ).reduce(
    (
      prev: { bundleName: string; paths: string[]; inject: boolean }[],
      curr
    ) => {
      const bundleName = curr.bundleName;
      const resolvedPath = resolve(root, curr.input);
      const existingEntry = prev.find((el) => el.bundleName === bundleName);
      if (existingEntry) {
        if (existingEntry.inject && !curr.inject) {
          // All entries have to be lazy for the bundle to be lazy.
          throw new Error(
            `The ${curr.bundleName} bundle is mixing injected and non-injected scripts.`
          );
        }

        existingEntry.paths.push(resolvedPath);
      } else {
        prev.push({
          bundleName,
          paths: [resolvedPath],
          inject: curr.inject,
        });
      }

      return prev;
    },
    []
  );

  if (globalScriptsByBundleName.length > 0) {
    // Add a new asset for each entry.
    globalScriptsByBundleName.forEach((script) => {
      // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
      const hash = script.inject ? hashFormat.script : '';
      const bundleName = script.bundleName;

      extraPlugins.push(
        new ScriptsWebpackPlugin({
          name: bundleName,
          sourceMap: !!buildOptions.sourceMap,
          filename: `${basename(bundleName)}${hash}.js`,
          scripts: script.paths,
          basePath: sourceRoot,
        })
      );
    });
  }

  if (buildOptions.progress) {
    extraPlugins.push(new ProgressPlugin({ profile: buildOptions.verbose }));
  }

  // TODO Needs source exported from webpack
  if (buildOptions.statsJson) {
    extraPlugins.push(
      new (class {
        apply(compiler: Compiler) {
          compiler.hooks.emit.tap('angular-cli-stats', (compilation) => {
            const data = JSON.stringify(
              compilation.getStats().toJson('verbose')
            );
            compilation.assets[`stats.json`] = new sources.RawSource(data);
          });
        }
      })()
    );
  }

  let sourceMapUseRule;
  if (!!buildOptions.sourceMap) {
    sourceMapUseRule = {
      use: [
        {
          loader: require.resolve('source-map-loader'),
        },
      ],
    };
  }

  // Allow loaders to be in a node_modules nested inside the devkit/build-angular package.
  // This is important in case loaders do not get hoisted.
  // If this file moves to another location, alter potentialNodeModules as well.
  const loaderNodeModules = findAllNodeModules(__dirname, projectRoot);
  loaderNodeModules.unshift('node_modules');

  return {
    profile: buildOptions.statsJson,
    resolve: {
      extensions: ['.ts', '.tsx', '.mjs', '.js'],
      symlinks: true,
      modules: [wco.tsConfig.options.baseUrl || projectRoot, 'node_modules'],
    },
    resolveLoader: {
      modules: loaderNodeModules,
    },
    entry: entryPoints,
    output: {
      path: resolve(root, buildOptions.outputPath as string),
      publicPath: buildOptions.deployUrl,
    },
    watch: buildOptions.watch,
    performance: {
      hints: false,
    },
    module: {
      // Show an error for missing exports instead of a warning.
      strictExportPresence: true,
      rules: [
        {
          test: /\.(eot|svg|cur|jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
          loader: require.resolve('file-loader'),
          options: {
            name: `[name]${hashFormat.file}.[ext]`,
          },
        },
        {
          test: /[\/\\]hot[\/\\]emitter\.js$/,
          parser: { node: { events: true } },
        },
        {
          test: /[\/\\]webpack-dev-server[\/\\]client[\/\\]utils[\/\\]createSocketUrl\.js$/,
          parser: { node: { querystring: true } },
        },
        {
          test: /\.js$/,
          // Factory files are processed by BO in the rules added in typescript.ts.
          exclude: /(ngfactory|ngstyle)\.js$/,
        },
        {
          test: /\.js$/,
          exclude: /(ngfactory|ngstyle)\.js$/,
          enforce: 'pre',
          ...sourceMapUseRule,
        },
      ],
    },
    plugins: extraPlugins,
  };
}
