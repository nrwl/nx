import { ExecutorContext, logger, workspaceRoot } from '@nrwl/devkit';
import { composePluginsSync } from '@nrwl/webpack/src/utils/config';
import { NormalizedWebpackExecutorOptions } from '@nrwl/webpack/src/executors/webpack/schema';
import { join } from 'path';
import {
  Configuration,
  DefinePlugin,
  ResolvePluginInstance,
  WebpackPluginInstance,
} from 'webpack';
import { mergePlugins } from './merge-plugins';
import { withReact } from '../with-react';

// This is shamelessly taken from CRA and modified for NX use
// https://github.com/facebook/create-react-app/blob/4784997f0682e75eb32a897b4ffe34d735912e6c/packages/react-scripts/config/env.js#L71
function getClientEnvironment(mode) {
  // Grab NODE_ENV and NX_* and STORYBOOK_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_PREFIX = /^NX_/i;
  const STORYBOOK_PREFIX = /^STORYBOOK_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_PREFIX.test(key) || STORYBOOK_PREFIX.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        NODE_ENV: process.env.NODE_ENV || mode,

        // Environment variables for Storybook
        // https://github.com/storybookjs/storybook/blob/bdf9e5ed854b8d34e737eee1a4a05add88265e92/lib/core-common/src/utils/envs.ts#L12-L21
        NODE_PATH: process.env.NODE_PATH || '',
        STORYBOOK: process.env.STORYBOOK || 'true',
        // This is to support CRA's public folder feature.
        // In production we set this to dot(.) to allow the browser to access these assets
        // even when deployed inside a subpath. (like in GitHub pages)
        // In development this is just empty as we always serves from the root.
        PUBLIC_URL: mode === 'production' ? '.' : '',
      }
    );

  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}

export const core = (prev, options) => ({
  ...prev,
  disableWebpackDefaults: true,
});

export const webpack = async (
  storybookWebpackConfig: Configuration = {},
  options: any
): Promise<Configuration> => {
  logger.info(
    '=> Loading Nx React Storybook Addon from "@nrwl/react/plugins/storybook"'
  );
  // In case anyone is missing dep and did not run migrations.
  // See: https://github.com/nrwl/nx/issues/14455
  try {
    require.resolve('@nrwl/webpack');
  } catch {
    throw new Error(
      `'@nrwl/webpack' package is not installed. Install it and try again.`
    );
  }

  const { withNx, withWeb } = require('@nrwl/webpack');
  const tsconfigPath = join(options.configDir, 'tsconfig.json');

  const builderOptions: NormalizedWebpackExecutorOptions = {
    ...options,
    root: options.configDir,
    // These are blank because root is the absolute path to .storybook folder
    projectRoot: '',
    sourceRoot: '',
    fileReplacements: [],
    sourceMap: true,
    styles: options.styles ?? [],
    optimization: {},
    tsConfig: tsconfigPath,
    extractCss: storybookWebpackConfig.mode === 'production',
    target: 'web',
  };

  // ESM build for modern browsers.
  let baseWebpackConfig: Configuration = {};
  const configure = composePluginsSync(
    withNx({ skipTypeChecking: true }),
    withWeb(),
    withReact()
  );
  const finalConfig = configure(baseWebpackConfig, {
    options: builderOptions,
    context: { root: workspaceRoot } as ExecutorContext, // The context is not used here.
  });

  return {
    ...storybookWebpackConfig,
    module: {
      ...storybookWebpackConfig.module,
      rules: [
        ...storybookWebpackConfig.module.rules,
        ...finalConfig.module.rules,
      ],
    },
    resolve: {
      ...storybookWebpackConfig.resolve,
      plugins: mergePlugins(
        ...((storybookWebpackConfig.resolve.plugins ??
          []) as ResolvePluginInstance[]),
        ...((finalConfig.resolve
          .plugins as unknown as ResolvePluginInstance[]) ?? [])
      ) as ResolvePluginInstance[],
    },
    plugins: mergePlugins(
      new DefinePlugin(
        getClientEnvironment(storybookWebpackConfig.mode).stringified
      ),
      ...(storybookWebpackConfig.plugins ?? []),
      ...(finalConfig.plugins ?? [])
    ) as WebpackPluginInstance[],
  };
};
