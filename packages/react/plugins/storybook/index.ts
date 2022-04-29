import { joinPathFragments, readJsonFile } from '@nrwl/devkit';
import { workspaceRoot } from '@nrwl/devkit';
import { getBaseWebpackPartial } from '@nrwl/web/src/utils/config';
import { getStylesPartial } from '@nrwl/web/src/utils/web.config';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';
import { logger } from '@storybook/node-logger';
import { join } from 'path';
import { gte } from 'semver';
import { Configuration, WebpackPluginInstance, DefinePlugin } from 'webpack';
import * as mergeWebpack from 'webpack-merge';
import { mergePlugins } from './merge-plugins';

const reactWebpackConfig = require('../webpack');

// This is shamelessly taken from CRA and modified for NX use
// https://github.com/facebook/create-react-app/blob/4784997f0682e75eb32a897b4ffe34d735912e6c/packages/react-scripts/config/env.js#L71
function getClientEnvironment(mode) {
  // Grab NODE_ENV and NX_* and STORYBOOK_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_PREFIX = /^NX_/i;
  const STORYBOOK_PREFIX = /^STORYBOOK__/i;

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

export const babelDefault = (): Record<
  string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  (string | [string, object])[]
> => {
  // Add babel plugin for styled-components or emotion.
  // We don't have a good way to know when a project uses one or the other, so
  // add the plugin only if the other style package isn't used.
  const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const hasStyledComponents = !!deps['styled-components'];

  const plugins = [];
  if (hasStyledComponents) {
    plugins.push(['styled-components', { ssr: false }]);
  }

  return {
    presets: [],
    plugins: [...plugins],
  };
};

export const core = (prev, options) => ({
  ...prev,
  disableWebpackDefaults: true,
});

export const webpack = async (
  storybookWebpackConfig: Configuration = {},
  options: any
): Promise<Configuration> => {
  logger.info(
    '=> Loading Nrwl React Storybook preset from "@nrwl/react/plugins/storybook"'
  );

  const tsconfigPath = join(options.configDir, 'tsconfig.json');

  const builderOptions: any = {
    ...options,
    root: options.configDir,
    sourceRoot: '',
    fileReplacements: [],
    sourceMap: {
      hidden: false,
      scripts: true,
      styles: true,
      vendors: false,
    },
    styles: [],
    optimization: {},
    tsConfig: tsconfigPath,
    extractCss: storybookWebpackConfig.mode === 'production',
  };

  const esm = true;
  const isScriptOptimizeOn = storybookWebpackConfig.mode !== 'development';
  const extractCss = storybookWebpackConfig.mode === 'production';

  // ESM build for modern browsers.
  const baseWebpackConfig = mergeWebpack.merge([
    getBaseWebpackPartial(builderOptions, {
      esm,
      isScriptOptimizeOn,
      skipTypeCheck: true,
    }),
    getStylesPartial(
      options.workspaceRoot,
      options.configDir,
      builderOptions,
      extractCss
    ),
  ]);

  // run it through the React customizations
  const finalConfig = reactWebpackConfig(baseWebpackConfig);

  // Check whether the project .babelrc uses @emotion/babel-plugin. There's currently
  // a Storybook issue (https://github.com/storybookjs/storybook/issues/13277) which apparently
  // doesn't work with `@emotion/*` >= v11
  // this is a workaround to fix that
  let resolvedEmotionAliases = {};
  const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  const emotionReactVersion = deps['@emotion/react'];
  if (
    emotionReactVersion &&
    gte(
      checkAndCleanWithSemver('@emotion/react', emotionReactVersion),
      '11.0.0'
    )
  ) {
    const babelrc = readJsonFile(
      joinPathFragments(options.configDir, '../', '.babelrc')
    );
    if (babelrc?.plugins?.includes('@emotion/babel-plugin')) {
      resolvedEmotionAliases = {
        resolve: {
          alias: {
            '@emotion/core': joinPathFragments(
              workspaceRoot,
              'node_modules',
              '@emotion/react'
            ),
            '@emotion/styled': joinPathFragments(
              workspaceRoot,
              'node_modules',
              '@emotion/styled'
            ),
            'emotion-theming': joinPathFragments(
              workspaceRoot,
              'node_modules',
              '@emotion/react'
            ),
          },
        },
      };
    }
  }
  return mergeWebpack.merge(
    {
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
            []) as unknown as WebpackPluginInstance[]),
          ...(finalConfig.resolve.plugins ?? [])
        ),
      },
      plugins: mergePlugins(
        new DefinePlugin(
          getClientEnvironment(storybookWebpackConfig.mode).stringified
        ),
        ...(storybookWebpackConfig.plugins ?? []),
        ...(finalConfig.plugins ?? [])
      ),
    },
    resolvedEmotionAliases
  );
};
