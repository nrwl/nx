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
}
