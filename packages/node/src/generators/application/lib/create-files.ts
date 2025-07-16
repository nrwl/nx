import {
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  toJS,
  Tree,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { join } from 'path';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { addVSCodeDebugConfiguration } from '../../../utils/vscode-debug-config';
import { NormalizedSchema } from './normalized-schema';

export function addAppFiles(tree: Tree, options: NormalizedSchema) {
  generateFiles(
    tree,
    join(__dirname, '../files/common'),
    options.appProjectRoot,
    {
      ...options,
      tmpl: '',
      name: options.name,
      root: options.appProjectRoot,
      offset: offsetFromRoot(options.appProjectRoot),
      rootTsConfigPath: getRelativePathToRootTsConfig(
        tree,
        options.appProjectRoot
      ),
      webpackPluginOptions:
        hasWebpackPlugin(tree) && options.addPlugin !== false
          ? {
              outputPath: options.isUsingTsSolutionConfig
                ? 'dist'
                : joinPathFragments(
                    offsetFromRoot(options.appProjectRoot),
                    'dist',
                    options.rootProject ? options.name : options.appProjectRoot
                  ),
              main: './src/main' + (options.js ? '.js' : '.ts'),
              tsConfig: './tsconfig.app.json',
              assets: ['./src/assets'],
            }
          : null,
    }
  );

  if (options.bundler !== 'webpack') {
    tree.delete(joinPathFragments(options.appProjectRoot, 'webpack.config.js'));
  }

  if (options.framework && options.framework !== 'none') {
    generateFiles(
      tree,
      join(__dirname, `../files/${options.framework}`),
      options.appProjectRoot,
      {
        ...options,
        tmpl: '',
        name: options.name,
        root: options.appProjectRoot,
        offset: offsetFromRoot(options.appProjectRoot),
        rootTsConfigPath: getRelativePathToRootTsConfig(
          tree,
          options.appProjectRoot
        ),
      }
    );
  }
  if (options.js) {
    toJS(tree);
  }

  // Update webpack config to include devtoolModuleFilenameTemplate for better debugging
  if (
    options.bundler === 'webpack' &&
    options.addPlugin !== false &&
    hasWebpackPlugin(tree)
  ) {
    const webpackConfigPath = joinPathFragments(
      options.appProjectRoot,
      'webpack.config.js'
    );
    if (tree.exists(webpackConfigPath)) {
      const webpackConfig = tree.read(webpackConfigPath, 'utf-8');

      if (
        webpackConfig &&
        !webpackConfig.includes('devtoolModuleFilenameTemplate')
      ) {
        const updatedConfig = webpackConfig.replace(
          /(output:\s*{\s*path:\s*[^}]+?),?\s*}/,
          (match, pathPart) => {
            const needsComma = !pathPart.endsWith(',');
            return `${pathPart}${needsComma ? ',' : ''}
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  }`;
          }
        );

        // Also ensure sourceMap is enabled in the plugin for development
        const finalConfig = updatedConfig.replace(
          /(generatePackageJson:\s*true,?)(\s*})/,
          "$1\n      sourceMap: process.env.NODE_ENV !== 'production',$2"
        );

        tree.write(webpackConfigPath, finalConfig);
      }
    }
  }

  // Generate a debug config for VS Code so that users can easily debug their application
  addVSCodeDebugConfiguration(tree, {
    projectName: options.name,
    projectRoot: options.appProjectRoot,
  });
}
