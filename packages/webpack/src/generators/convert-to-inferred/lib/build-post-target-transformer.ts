import {
  joinPathFragments,
  stripIndents,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { type WebpackExecutorOptions } from '../../../executors/webpack/schema';
import { toProjectRelativePath } from './utils';
import { NxAppWebpackPluginOptions } from '@nx/webpack/app-plugin';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

interface ProjectDetail {
  projectName: string;
  root: string;
}

function removePropsFromTargetOptions(
  tree: Tree,
  originalOptions: WebpackExecutorOptions,
  options: WebpackExecutorOptions,
  webpackConfigPath: string,
  root: string,
  customName?: string
) {
  //TODO: Add default values for options that are not present

  const mergedOptions = {
    ...originalOptions,
    ...(({ webpackConfig, ...rest }) => rest)({ ...options }),
  };

  if (options.outputPath) {
    mergedOptions.outputPath = toProjectRelativePath(options.outputPath, root);
    delete options.outputPath;
  }
  if (options.index) {
    mergedOptions.index = toProjectRelativePath(options.index, root);
    delete options.index;
  }
  if (options.main) {
    mergedOptions.main = toProjectRelativePath(options.main, root);
    delete options.main;
  }
  if (options.assets) {
    mergedOptions.assets = options.assets.map((asset) => {
      if (typeof asset === 'string') {
        return toProjectRelativePath(asset, root);
      }
      return {
        ...asset,
        input: toProjectRelativePath(asset.input, root),
        output: toProjectRelativePath(asset.output, root),
      };
    });
    delete options.assets;
  }

  if (options.tsConfig) {
    mergedOptions.tsConfig = toProjectRelativePath(options.tsConfig, root);
    delete options.tsConfig;
  }
  if (options.styles) {
    mergedOptions.styles = options.styles.map((style) => {
      if (typeof style === 'string') {
        return toProjectRelativePath(style, root);
      }
      return {
        ...style,
        input: toProjectRelativePath(style.input, root),
      };
    });
    delete options.styles;
  }
  if (options.babelConfig) {
    mergedOptions.babelConfig = toProjectRelativePath(
      options.babelConfig,
      root
    );
    delete options.babelConfig;
  }
  if (options.additionalEntryPoints) {
    mergedOptions.additionalEntryPoints = options.additionalEntryPoints.map(
      (entry) => {
        return {
          ...entry,
          entryPath: toProjectRelativePath(entry.entryPath, root),
        };
      }
    );
    delete options.additionalEntryPoints;
  }
  if (options.scripts) {
    mergedOptions.scripts = options.scripts.map((script) => {
      if (typeof script === 'string') {
        return toProjectRelativePath(script, root);
      }
      return {
        ...script,
        input: toProjectRelativePath(script.input, root),
      };
    });
    delete options.scripts;
  }
  if (options.fileReplacements) {
    mergedOptions.fileReplacements = options.fileReplacements.map(
      (replacement) => {
        return {
          replace: toProjectRelativePath(replacement.replace, root),
          with: toProjectRelativePath(replacement.with, root),
        };
      }
    );
    delete options.fileReplacements;
  }

  if (options.postcssConfig) {
    mergedOptions.postcssConfig = toProjectRelativePath(
      options.postcssConfig,
      root
    );
    delete options.postcssConfig;
  }
  if (options.stylePreprocessorOptions) {
    mergedOptions.stylePreprocessorOptions =
      options.stylePreprocessorOptions?.includePaths.map((path: string) =>
        toProjectRelativePath(path, root)
      );
    delete options.stylePreprocessorOptions;
  }
  if (options.subresourceIntegrity) {
    delete options.subresourceIntegrity;
  }

  if (options.publicPath) {
    mergedOptions.publicPath = toProjectRelativePath(options.publicPath, root);
    delete options.publicPath;
  }
  Object.keys(options).forEach((option) => {
    if (options[option]) {
      delete options[option];
    }
  });

  const newWebpackConfigContent = stripIndents`
    const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
    const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
    const { join } = require('path');
    
    // These options were migrated by @nx/webpack:convert-to-inferred from project.json
    const options = ${JSON.stringify(mergedOptions, null, 2)};
    
    let config = {
      output: {
        path: join(__dirname, ${options.outputPath})
      },
      plugins: [
        new NxAppWebpackPlugin(options),
        new NxReactWebpackPlugin({
          // Uncomment this line if you don't want to use SVGR
          // See: https://react-svgr.com/
          // svgr: false
        })
      ]
    }
    config = require('${webpackConfigPath}')(config, options);
    module.exports = config;
  `;

  const customFileName = customName ?? 'webpack.config.js';
  if (tree.exists(joinPathFragments(root, customFileName))) {
    throw new Error(
      'Cannot create a new webpack.config.js file because one already exists'
    );
  }

  tree.write(joinPathFragments(root, customFileName), newWebpackConfigContent);
}

function updateUserWebpackConfig(
  tree,
  projectDetails,
  updatedOriginalWebpackFileName
) {
  // TODO: (nicholas) Add logic to remove WithNx, withWeb and withReact from the webpack.config.js file
  // We can probably grab the values passed in each of the functions and merge them into the new webpack.config.js file
}

export function buildPostTargetTransformer(
  target: TargetConfiguration<WebpackExecutorOptions>,
  tree: Tree,
  projectDetails: ProjectDetail,
  inferredTargetConfiguration: TargetConfiguration
) {
  const originalDefaultOptions = target.options;
  let webpackConfigPath = joinPathFragments(
    projectDetails.root,
    'webpack.config.js'
  );

  if (tree.exists(webpackConfigPath)) {
    const updatedOriginalWebpackFileName = 'webpack.config.custom.js';
    if (target.options) {
      tree.rename(
        webpackConfigPath,
        joinPathFragments(projectDetails.root, updatedOriginalWebpackFileName)
      );

      updateUserWebpackConfig(
        tree,
        projectDetails,
        updatedOriginalWebpackFileName
      );

      removePropsFromTargetOptions(
        tree,
        originalDefaultOptions,
        target.options,
        updatedOriginalWebpackFileName,
        projectDetails.root
      );
    }

    if (target.configurations) {
      for (const configuration in target.configurations) {
        const configWebpackFileName = `webpack.config.${configuration}.js`;

        removePropsFromTargetOptions(
          tree,
          originalDefaultOptions,
          target.configurations[configuration],
          updatedOriginalWebpackFileName,
          projectDetails.root,
          configWebpackFileName
        );

        if (
          'defaultConfiguration' in target &&
          !target.configurations[target.defaultConfiguration]
        ) {
          delete target.defaultConfiguration;
        }
      }
    }
  }
  return target;
}

function createOrUpdateWebpackConfig(
  tree: Tree,
  projectDetails: ProjectDetail,
  options: NxAppWebpackPluginOptions
) {
  // const relativeOutputPath = toProjectRelativePath(target.options.outputPath, projectDetails.root);
  const baseWebpack = stripIndents`
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, ${options.outputPath})
  }
  plugins: [
    new NxAppWebpackPlugin({
      ${JSON.stringify(options, null, 2)}
    }),
    new NxReactWebpackPlugin({
      // svgr: false
    })
  ]
}
`;

  const webpackConfigPath = joinPathFragments(
    projectDetails.root,
    'webpack.config.js'
  );
  if (!tree.exists(webpackConfigPath)) {
    tree.write(
      webpackConfigPath,
      stripIndents`
      module.exports = {
        plugins: [
          new NxAppWebpackPlugin(),
          new NxReactWebpackPlugin()
        ]
      }
    `
    );
  }
}
