import { joinPathFragments } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { getBaseWebpackPartial } from '@nrwl/web/src/utils/config';
import { getStylesPartial } from '@nrwl/web/src/utils/web.config';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';
import { logger } from '@storybook/node-logger';
import { join } from 'path';
import { gte } from 'semver';
import { Configuration, WebpackPluginInstance } from 'webpack';
import * as mergeWebpack from 'webpack-merge';
import { mergePlugins } from './merge-plugins';

const reactWebpackConfig = require('../webpack');

export const babelDefault = (): Record<
  string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  (string | [string, object])[]
> => {
  // Add babel plugin for styled-components or emotion.
  // We don't have a good way to know when a project uses one or the other, so
  // add the plugin only if the other style package isn't used.
  const packageJson = readJsonFile(join(appRootPath, 'package.json'));
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
    getBaseWebpackPartial(builderOptions, esm, isScriptOptimizeOn),
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
  const packageJson = readJsonFile(join(appRootPath, 'package.json'));
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
    if (babelrc.plugins.includes('@emotion/babel-plugin')) {
      resolvedEmotionAliases = {
        resolve: {
          alias: {
            '@emotion/core': joinPathFragments(
              appRootPath,
              'node_modules',
              '@emotion/react'
            ),
            '@emotion/styled': joinPathFragments(
              appRootPath,
              'node_modules',
              '@emotion/styled'
            ),
            'emotion-theming': joinPathFragments(
              appRootPath,
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
        ...(storybookWebpackConfig.plugins ?? []),
        ...(finalConfig.plugins ?? [])
      ),
    },
    resolvedEmotionAliases
  );
};
