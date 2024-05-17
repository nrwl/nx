import { join } from 'path';
import {
  Tree,
  generateFiles,
  names,
  offsetFromRoot,
  joinPathFragments,
  updateJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { NormalizedSchema } from '../schema';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';

export function createApplicationFiles(tree: Tree, options: NormalizedSchema) {
  if (options.bundler === 'vite') {
    generateFiles(
      tree,
      join(__dirname, '../files/app-vite'),
      options.appProjectRoot,
      {
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        rootTsConfigPath: getRelativePathToRootTsConfig(
          tree,
          options.appProjectRoot
        ),
      }
    );
  } else {
    generateFiles(
      tree,
      join(__dirname, '../files/app-webpack'),
      options.appProjectRoot,
      {
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        rootTsConfigPath: getRelativePathToRootTsConfig(
          tree,
          options.appProjectRoot
        ),
        webpackPluginOptions: hasWebpackPlugin(tree)
          ? {
              compiler: options.compiler,
              target: 'web',
              outputPath: joinPathFragments(
                'dist',
                options.appProjectRoot != '.'
                  ? options.appProjectRoot
                  : options.projectName
              ),
              tsConfig: './tsconfig.app.json',
              main: './src/main.ts',
              assets: ['./src/favicon.ico', './src/assets'],
              index: './src/index.html',
              baseHref: '/',
              styles: [`./src/styles.${options.style}`],
            }
          : null,
      }
    );
    if (options.unitTestRunner === 'none') {
      tree.delete(
        join(options.appProjectRoot, './src/app/app.element.spec.ts')
      );
    }
  }

  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.json'),
    (json) => {
      return {
        ...json,
        compilerOptions: {
          ...(json.compilerOptions || {}),
          strict: options.strict,
        },
      };
    }
  );
}
