import {
  TargetConfiguration,
  Tree,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import type { WithReactOptions } from '@nx/react';
import type { WithNxOptions } from '@nx/webpack';

import { NormalizedSchema } from './normalize-schema';

export function createNxWebpackPluginOptions(
  tree: Tree,
  options: NormalizedSchema
): WithNxOptions & WithReactOptions {
  return {
    target: 'web',
    compiler: 'babel',
    outputPath: joinPathFragments(
      'dist',
      options.projectRoot != '.' ? options.projectRoot : options.project
    ),
    index: './src/index.html',
    baseHref: '/',
    main: `./src/main-web.tsx`,
    tsConfig: determineTsConfig(tree, options),
    assets: ['./src/favicon.ico', './src/assets'],
    styles: [],
  };
}

export function determineTsConfig(tree: Tree, options: NormalizedSchema) {
  const project = readProjectConfiguration(tree, options.project);

  const appJson = joinPathFragments(project.root, 'tsconfig.app.json');
  if (tree.exists(appJson)) return 'tsconfig.app.json';

  const libJson = joinPathFragments(project.root, 'tsconfig.lib.json');
  if (tree.exists(libJson)) return 'tsconfig.lib.json';

  return 'tsconfig.json';
}
