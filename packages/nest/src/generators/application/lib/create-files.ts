import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function createFiles(tree: Tree, options: NormalizedOptions): void {
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
  if (options.unitTestRunner === 'jest') {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'test'),
      joinPathFragments(options.appProjectRoot, 'src'),
      {
        tmpl: '',
      }
    );
  }
}
