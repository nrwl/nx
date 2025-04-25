import type { StylePreprocessorOptions } from '@nx/angular-rspack-compiler';
import { workspaceRoot } from '@nx/devkit';
import { CssExtractRspackPlugin, type RuleSetUseItem } from '@rspack/core';
import { relative, resolve } from 'node:path';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { findTailwindConfigurationFile } from '../utils/tailwind';

/**
 * Returns an array of style loaders for sass and less. Both loader´s are always returned
 *
 * @param stylePreprocessorOptions
 * @param sourceMap
 */
export async function getStyleLoaders(
  buildOptions: NormalizedAngularRspackPluginOptions
) {
  const cssSourceMap = buildOptions.sourceMap.styles;
  const includePaths =
    buildOptions.stylePreprocessorOptions?.includePaths?.map((p) =>
      resolve(workspaceRoot, p)
    ) ?? [];

  const extraPostcssPlugins: import('postcss').Plugin[] = [];

  // Attempt to setup Tailwind CSS
  // Only load Tailwind CSS plugin if configuration file was found.
  // This acts as a guard to ensure the project actually wants to use Tailwind CSS.
  // The package may be unknowningly present due to a third-party transitive package dependency.
  const tailwindConfigPath = await findTailwindConfigurationFile(
    workspaceRoot,
    buildOptions.root
  );
  if (tailwindConfigPath) {
    let tailwindPackagePath: string | undefined;
    try {
      tailwindPackagePath = require.resolve('tailwindcss', {
        paths: [workspaceRoot, buildOptions.root],
      });
    } catch {
      const relativeTailwindConfigPath = relative(
        workspaceRoot,
        tailwindConfigPath
      );
      console.warn(
        `Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
          ` but the 'tailwindcss' package is not installed.` +
          ` To enable Tailwind CSS, please install the 'tailwindcss' package.`
      );
    }
    if (tailwindPackagePath) {
      extraPostcssPlugins.push(
        require(tailwindPackagePath)({ config: tailwindConfigPath })
      );
    }
  }

  const autoprefixer: typeof import('autoprefixer') = require('autoprefixer');

  const postcssOptionsCreator = (inlineSourcemaps: boolean) => {
    const optionGenerator = () => ({
      map: inlineSourcemaps
        ? {
            inline: true,
            annotation: false,
          }
        : undefined,
      plugins: [
        ...extraPostcssPlugins,
        autoprefixer({
          ignoreUnknownVersions: true,
          overrideBrowserslist: buildOptions.supportedBrowsers,
        }),
      ],
    });
    // postcss-loader fails when trying to determine configuration files for data URIs
    optionGenerator.config = false;

    return optionGenerator;
  };

  let componentsSourceMap = !!cssSourceMap;
  if (cssSourceMap) {
    // TODO: use below once we support optimization granular options
    // if (buildOptions.optimization.styles.minify) {
    if (buildOptions.optimization) {
      // Never use component css sourcemap when style optimizations are on.
      // It will just increase bundle size without offering good debug experience.
      console.warn(
        'Components styles sourcemaps are not generated when styles optimization is enabled.'
      );
      componentsSourceMap = false;
    } else if (buildOptions.sourceMap.hidden) {
      // Inline all sourcemap types except hidden ones, which are the same as no sourcemaps
      // for component css.
      console.warn(
        'Components styles sourcemaps are not generated when sourcemaps are hidden.'
      );
      componentsSourceMap = false;
    }
  }

  const postCss = require('postcss');
  const postCssLoaderPath = require.resolve('postcss-loader');

  const componentStyleLoaders: RuleSetUseItem[] = [
    {
      loader: require.resolve('css-loader'),
      options: {
        url: false,
        sourceMap: componentsSourceMap,
        importLoaders: 1,
        exportType: 'string',
        esModule: false,
      },
    },
    {
      loader: postCssLoaderPath,
      options: {
        implementation: postCss,
        postcssOptions: postcssOptionsCreator(componentsSourceMap),
      },
    },
  ];

  const globalStyleLoaders: RuleSetUseItem[] = [
    {
      loader: CssExtractRspackPlugin.loader,
    },
    {
      loader: require.resolve('css-loader'),
      options: {
        url: false,
        sourceMap: !!cssSourceMap,
        importLoaders: 1,
      },
    },
    {
      loader: postCssLoaderPath,
      options: {
        implementation: postCss,
        postcssOptions: postcssOptionsCreator(false),
        sourceMap: !!cssSourceMap,
      },
    },
  ];

  const styleLanguages: {
    extensions: string[];
    use: RuleSetUseItem[];
  }[] = [
    {
      extensions: ['css'],
      use: [],
    },
    {
      extensions: ['scss'],
      use: [
        {
          loader: require.resolve('resolve-url-loader'),
          options: {
            sourceMap: cssSourceMap,
          },
        },
        {
          loader: require.resolve('sass-loader'),
          options: getSassLoaderOptions(
            includePaths,
            buildOptions.stylePreprocessorOptions?.sass
          ),
        },
      ],
    },
    {
      extensions: ['sass'],
      use: [
        {
          loader: require.resolve('resolve-url-loader'),
          options: {
            sourceMap: cssSourceMap,
          },
        },
        {
          loader: require.resolve('sass-loader'),
          options: getSassLoaderOptions(
            includePaths,
            buildOptions.stylePreprocessorOptions?.sass
          ),
        },
      ],
    },
    {
      extensions: ['less'],
      use: [
        {
          loader: require.resolve('less-loader'),
          options: {
            sourceMap: cssSourceMap,
            lessOptions: {
              javascriptEnabled: true,
              paths: includePaths,
            },
          },
        },
      ],
    },
  ];

  return styleLanguages.map(({ extensions, use }) => ({
    test: new RegExp(`\\.(?:${extensions.join('|')})$`, 'i'),
    rules: [
      // Setup processing rules for global and component styles
      {
        oneOf: [
          // Global styles are only defined global styles
          {
            use: globalStyleLoaders,
            resourceQuery: /\?ngGlobalStyle/,
          },
          // Component styles are all styles except defined global styles
          {
            use: componentStyleLoaders,
            resourceQuery: /\?ngResource/,
          },
        ],
      },
      { use },
    ],
  }));
}

function getSassLoaderOptions(
  includePaths: string[],
  sassOptions: StylePreprocessorOptions['sass']
): Record<string, unknown> {
  return {
    api: 'modern-compiler',
    sourceMap: true,
    sourceMapIncludeSources: true,
    implementation: require.resolve('sass-embedded'),
    includePaths,
    ...(sassOptions ?? {}),
  };
}
