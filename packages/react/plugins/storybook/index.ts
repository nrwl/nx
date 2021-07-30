import { Configuration } from 'webpack';
const reactWebpackConfig = require('../webpack');
import { logger } from '@storybook/node-logger';
import { mergePlugins } from './merge-plugins';
import * as mergeWebpack from 'webpack-merge';
import { join } from 'path';
import { getStylesPartial } from '@nrwl/web/src/utils/web.config';
import { getBaseWebpackPartial } from '@nrwl/web/src/utils/config';
import { readJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';

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
  const baseWebpackConfig = mergeWebpack([
    getBaseWebpackPartial(builderOptions, esm, isScriptOptimizeOn),
    getStylesPartial(options.configDir, builderOptions, extractCss),
  ]);

  // run it through the React customizations
  const finalConfig = reactWebpackConfig(baseWebpackConfig);

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
        ...storybookWebpackConfig.resolve.plugins,
        ...finalConfig.resolve.plugins
      ),
    },
    plugins: mergePlugins(
      ...storybookWebpackConfig.plugins,
      ...finalConfig.plugins
    ),
  };
};
