import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments } from '@nrwl/devkit';
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
