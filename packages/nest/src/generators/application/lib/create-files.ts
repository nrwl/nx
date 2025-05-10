import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function createFilesForFramework(
  tree: Tree,
  options: NormalizedOptions
): void {
  const templatePath =
    options.framework === 'fastify'
      ? joinPathFragments(__dirname, '..', 'files', 'fastify')
      : joinPathFragments(__dirname, '..', 'files', 'express');

  generateFiles(
    tree,
    templatePath,
    joinPathFragments(options.appProjectRoot, 'src'),
    {
      tmpl: '',
      name: options.appProjectName,
      root: options.appProjectRoot,
    }
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'common'),
    joinPathFragments(options.appProjectRoot, 'src'),
    {
      tmpl: '',
      name: options.appProjectName,
      root: options.appProjectRoot,
    }
  );
}
