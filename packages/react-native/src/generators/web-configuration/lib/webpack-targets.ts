import { TargetConfiguration, joinPathFragments } from '@nx/devkit';
import type { WithReactOptions } from '@nx/react';
import type { WithNxOptions } from '@nx/webpack';

import { NormalizedSchema } from './normalize-schema';

export function createBuildTarget(
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/webpack:webpack',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      compiler: 'babel',
      outputPath: joinPathFragments(
        'dist',
        options.projectRoot != '.' ? options.projectRoot : options.project,
        'web'
      ),
      index: joinPathFragments(options.projectRoot, 'src/index.html'),
      baseHref: '/',
      main: joinPathFragments(options.projectRoot, `src/main-web.tsx`),
      tsConfig: joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
      assets: [
        joinPathFragments(options.projectRoot, 'src/favicon.ico'),
        joinPathFragments(options.projectRoot, 'src/assets'),
      ],
      webpackConfig: joinPathFragments(
        options.projectRoot,
        'webpack.config.js'
      ),
    },
    configurations: {
      development: {
        extractLicenses: false,
        optimization: false,
        sourceMap: true,
        vendorChunk: true,
      },
      production: {
        optimization: true,
        outputHashing: 'all',
        sourceMap: false,
        namedChunks: false,
        extractLicenses: true,
        vendorChunk: false,
      },
    },
  };
}

export function createServeTarget(
  options: NormalizedSchema
): TargetConfiguration {
  return {
    executor: '@nx/webpack:dev-server',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.project}:build`,
      hmr: true,
    },
    configurations: {
      development: {
        buildTarget: `${options.project}:build:development`,
      },
      production: {
        buildTarget: `${options.project}:build:production`,
        hmr: false,
      },
    },
  };
}

export function createNxWebpackPluginOptions(
  options: NormalizedSchema
): WithNxOptions & WithReactOptions {
  return {
    target: 'web',
    compiler: 'babel',
    outputPath: joinPathFragments(
      'dist',
      options.projectRoot != '.' ? options.projectRoot : options.project
    ),
    index: './src/index.html',
    baseHref: '/',
    main: `./src/main-web.tsx`,
    tsConfig: './tsconfig.app.json',
    assets: ['./src/favicon.ico', './src/assets'],
    styles: [],
  };
}
