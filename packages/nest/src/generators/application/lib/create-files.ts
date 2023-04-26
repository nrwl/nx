import type { Tree } from '@nx/devkit';
import { generateFiles, joinPathFragments } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function createFiles(tree: Tree, options: NormalizedOptions): void {
  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    joinPathFragments(options.appProjectRoot, 'src'),
    {
      tmpl: '',
      name: options.name,
      root: options.appProjectRoot,
    }
  );
}
