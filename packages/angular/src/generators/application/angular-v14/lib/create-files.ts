import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

export function createFiles(tree: Tree, options: NormalizedSchema) {
  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files'),
    options.appProjectRoot,
    {
      ...options,
      tpl: '',
    }
  );

  if (!options.routing) {
    tree.delete(
      joinPathFragments(options.appProjectRoot, 'src/app/app.routes.ts')
    );
  }
}
