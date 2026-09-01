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
import { hasRspackPlugin } from '../../../utils/has-rspack-plugin';
import { addVSCodeDebugConfiguration } from '../../../utils/vscode-debug-config';
import { NormalizedSchema } from './normalized-schema';

function bundlerPluginOptions(options: NormalizedSchema) {
  return {
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
    generatePackageJson: !options.isUsingTsSolutionConfig,
  };
}

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
          ? bundlerPluginOptions(options)
          : null,
      rspackPluginOptions:
        hasRspackPlugin(tree) && options.addPlugin !== false
          ? bundlerPluginOptions(options)
          : null,
    }
  );

  // files/common holds a config for every bundler; drop the ones not chosen.
  for (const bundler of ['webpack', 'rspack']) {
    if (options.bundler !== bundler) {
      tree.delete(
        joinPathFragments(options.appProjectRoot, `${bundler}.config.js`)
      );
    }
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

  // Generate a debug config for VS Code so that users can easily debug their application
  addVSCodeDebugConfiguration(tree, {
    projectName: options.name,
    projectRoot: options.appProjectRoot,
  });
}
