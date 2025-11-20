import type { Tree } from '@nx/devkit';
import { generateFiles } from '@nx/devkit';
import { join } from 'path';
import type { NormalizedOptions } from '../schema';

export function createFiles(tree: Tree, options: NormalizedOptions): void {
  generateFiles(
    tree,
    join(__dirname, '..', 'files', 'common'),
    join(options.appProjectRoot, 'src'),
    {
      tmpl: '',
      name: options.appProjectName,
      root: options.appProjectRoot,
    }
  );
  if (options.unitTestRunner === 'jest') {
    generateFiles(
      tree,
      join(__dirname, '..', 'files', 'test'),
      join(options.appProjectRoot, 'src'),
      {
        tmpl: '',
      }
    );
  }
}
