import { workspaceRoot } from '@nx/devkit';
import {
  CssExtractRspackPlugin,
  type LoaderContext,
  type Plugins,
  type RuleSetRules,
  type RuleSetUseItem,
} from '@rspack/core';
import { createRequire } from 'node:module';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FileImporter } from 'sass';
import type {
  HashFormat,
  NormalizedAngularRspackPluginOptions,
} from '../../models';
import PostcssCliResources from '../../utils/postcss-cli-resources';
import {
  findTailwindConfiguration,
  generateSearchDirectories,
  loadPostcssConfiguration,
  type SearchDirectory,
} from '../../utils/postcss-configuration';

export async function getStylesConfig(
  buildOptions: NormalizedAngularRspackPluginOptions,
  hashFormat: HashFormat,
  platform: 'browser' | 'server'
): Promise<{
  loaderRules: RuleSetRules;
  plugins: Plugins;
}> {
  const extraPlugins: Plugins = [];

  const cssSourceMap = buildOptions.sourceMap.styles;

  // use includePaths from appConfig
  const includePaths =
    buildOptions.stylePreprocessorOptions?.includePaths?.map((p) =>
      resolve(buildOptions.root, p)
    ) ?? [];

  const assetNameTemplate = assetNameTemplateFactory(hashFormat);

  const extraPostcssPlugins: import('postcss').Plugin[] = [];

  // A configuration file can exist in the project or workspace root
  const searchDirectories = await generateSearchDirectories([
    buildOptions.root,
    workspaceRoot,
  ]);
  const postcssConfiguration = await loadPostcssConfiguration(
    searchDirectories
  );
  if (postcssConfiguration) {
    for (const [pluginName, pluginOptions] of postcssConfiguration.plugins) {
      const { default: plugin } = await import(pluginName);
      if (typeof plugin !== 'function' || plugin.postcss !== true) {
        throw new Error(
          `Attempted to load invalid Postcss plugin: "${pluginName}"`
        );
      }

      extraPostcssPlugins.push(plugin(pluginOptions));
    }
  } else {
    const tailwindConfig = await getTailwindConfig(
      searchDirectories,
      workspaceRoot
    );
    if (tailwindConfig) {
      const tailwind = await import(tailwindConfig.package);
      extraPostcssPlugins.push(
        tailwind.default({ config: tailwindConfig.file })
      );
    }
  }

  const autoprefixer: typeof import('autoprefixer') = require('autoprefixer');

  const postcssOptionsCreator = (
    inlineSourcemaps: boolean,
    extracted: boolean
  ) => {
    const optionGenerator = (loader: LoaderContext<unknown>) => ({
      map: inlineSourcemaps
        ? {
            inline: true,
            annotation: false,
          }
        : undefined,
      plugins: [
        PostcssCliResources({
          baseHref: buildOptions.baseHref,
          deployUrl: buildOptions.deployUrl,
          resourcesOutputPath: buildOptions.outputPath.media,
          loader,
          filename: assetNameTemplate,
          emitFile: platform !== 'server',
          extracted,
        }),
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

  // extract global css from js files into own css file.
  extraPlugins.push(
    new CssExtractRspackPlugin({ filename: `[name]${hashFormat.extract}.css` })
  );

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
        postcssOptions: postcssOptionsCreator(componentsSourceMap, false),
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
        postcssOptions: postcssOptionsCreator(false, true),
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
            workspaceRoot,
            includePaths,
            false,
            !!buildOptions.verbose,
            !!buildOptions.preserveSymlinks
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
            workspaceRoot,
            includePaths,
            true,
            !!buildOptions.verbose,
            !!buildOptions.preserveSymlinks
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

  return {
    loaderRules: styleLanguages.map(({ extensions, use }) => ({
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
    })),
    plugins: extraPlugins,
  };
}

function assetNameTemplateFactory(
  hashFormat: HashFormat
): (resourcePath: string) => string {
  const visitedFiles = new Map<string, string>();

  return (resourcePath: string) => {
    if (hashFormat.file) {
      // File names are hashed therefore we don't need to handle files with the same file name.
      return `[name]${hashFormat.file}.[ext]`;
    }

    const filename = basename(resourcePath);
    // Check if the file with the same name has already been processed.
    const visited = visitedFiles.get(filename);
    if (!visited) {
      // Not visited.
      visitedFiles.set(filename, resourcePath);

      return filename;
    } else if (visited === resourcePath) {
      // Same file.
      return filename;
    }

    // File has the same name but it's in a different location.
    return '[path][name].[ext]';
  };
}

function getSassLoaderOptions(
  root: string,
  includePaths: string[],
  indentedSyntax: boolean,
  verbose: boolean,
  preserveSymlinks: boolean
): Record<string, unknown> {
  return {
    api: 'modern-compiler',
    sourceMap: true,
    implementation: require.resolve('sass-embedded'),
    // Webpack importer is only implemented in the legacy API and we have our own custom Webpack importer.
    // See: https://github.com/webpack-contrib/sass-loader/blob/997f3eb41d86dd00d5fa49c395a1aeb41573108c/src/utils.js#L642-L651
    webpackImporter: false,
    sassOptions: (loaderContext: LoaderContext<unknown>) => ({
      importers: [
        getSassResolutionImporter(loaderContext, root, preserveSymlinks),
      ],
      loadPaths: includePaths,
      // Use expanded as otherwise sass will remove comments that are needed for autoprefixer
      // Ex: /* autoprefixer grid: autoplace */
      // See: https://github.com/webpack-contrib/sass-loader/blob/45ad0be17264ceada5f0b4fb87e9357abe85c4ff/src/getSassOptions.js#L68-L70
      style: 'expanded',
      // Silences compiler warnings from 3rd party stylesheets
      quietDeps: !verbose,
      verbose,
      syntax: indentedSyntax ? 'indented' : 'scss',
      sourceMapIncludeSources: true,
    }),
  };
}

function getSassResolutionImporter(
  loaderContext: LoaderContext<unknown>,
  root: string,
  preserveSymlinks: boolean
): FileImporter<'async'> {
  const commonResolverOptions: Parameters<
    (typeof loaderContext)['getResolve']
  >[0] = {
    conditionNames: ['sass', 'style'],
    mainFields: ['sass', 'style', 'main', '...'],
    extensions: ['.scss', '.sass', '.css'],
    restrictions: [/\.((sa|sc|c)ss)$/i] as any,
    preferRelative: true,
    symlinks: !preserveSymlinks,
  };

  // Sass also supports import-only files. If you name a file <name>.import.scss, it will only be loaded for imports, not for @uses.
  // See: https://sass-lang.com/documentation/at-rules/import#import-only-files
  const resolveImport = loaderContext.getResolve({
    byDependency: {
      'sass-import': {
        ...commonResolverOptions,
        mainFiles: ['_index.import', '_index', 'index.import', 'index', '...'],
      },
    },
  });

  const resolveModule = loaderContext.getResolve({
    byDependency: {
      'sass-module': {
        ...commonResolverOptions,
        mainFiles: ['_index', 'index', '...'],
      },
    },
  });

  return {
    findFileUrl: async (
      url: string,
      { fromImport, containingUrl }
    ): Promise<URL | null> => {
      if (url.charAt(0) === '.') {
        // Let Sass handle relative imports.
        return null;
      }

      let resolveDir = root;
      if (containingUrl) {
        resolveDir = dirname(fileURLToPath(containingUrl));
      }

      const resolve = fromImport ? resolveImport : resolveModule;
      // Try to resolve from root of workspace
      const result = await tryResolve(resolve, resolveDir, url);

      return result ? pathToFileURL(result) : null;
    },
  };
}

async function tryResolve(
  resolve: ReturnType<LoaderContext<unknown>['getResolve']>,
  root: string,
  url: string
): Promise<string | false | undefined> {
  const promisifiedResolve = (root: string, url: string) =>
    new Promise<string | false | undefined>((res, rej) => {
      resolve(root, url, (err, result) => {
        if (err) {
          rej();
        } else {
          res(result);
        }
      });
    });

  try {
    return await promisifiedResolve(root, url);
  } catch {
    // Try to resolve a partial file
    // @use '@material/button/button' as mdc-button;
    // `@material/button/button` -> `@material/button/_button`
    const lastSlashIndex = url.lastIndexOf('/');
    const underscoreIndex = lastSlashIndex + 1;
    if (underscoreIndex > 0 && url.charAt(underscoreIndex) !== '_') {
      const partialFileUrl = `${url.slice(0, underscoreIndex)}_${url.slice(
        underscoreIndex
      )}`;

      return promisifiedResolve(root, partialFileUrl).catch(() => undefined);
    }
  }

  return undefined;
}

async function getTailwindConfig(
  searchDirectories: SearchDirectory[],
  workspaceRoot: string
): Promise<{ file: string; package: string } | undefined> {
  const tailwindConfigurationPath =
    findTailwindConfiguration(searchDirectories);

  if (!tailwindConfigurationPath) {
    return undefined;
  }

  // Create a node resolver from the configuration file
  const resolver = createRequire(tailwindConfigurationPath);
  try {
    return {
      file: tailwindConfigurationPath,
      package: resolver.resolve('tailwindcss'),
    };
  } catch {
    const relativeTailwindConfigPath = relative(
      workspaceRoot,
      tailwindConfigurationPath
    );
    console.warn(
      `Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
        ` but the 'tailwindcss' package is not installed.` +
        ` To enable Tailwind CSS, please install the 'tailwindcss' package.`
    );
  }

  return undefined;
}
