import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import type { NormalizedOptions } from '../schema';

export function deleteFiles(tree: Tree, options: NormalizedOptions): void {
  tree.delete(
    joinPathFragments(
      options.projectRoot,
      'src',
      'lib',
      `${options.fileName}.ts`
    )
  );

  if (options.unitTestRunner !== 'none') {
    tree.delete(
      joinPathFragments(
        options.projectRoot,
        'src',
        'lib',
        `${options.fileName}.spec.ts`
      )
    );
  }

  if (!options.buildable && !options.publishable) {
    tree.delete(joinPathFragments(options.projectRoot, 'package.json'));
  }
}
