import { joinPathFragments, type Tree } from '@nx/devkit';
import { componentGenerator } from '../../component/component';
import { addChildren } from './add-children';
import { addLoadChildren } from './add-load-children';
import type { NormalizedSchema } from './normalized-schema';

export async function addStandaloneComponent(
  tree: Tree,
  { libraryOptions, componentOptions }: NormalizedSchema
) {
  await componentGenerator(tree, {
    ...componentOptions,
    name: componentOptions.name,
    directory: joinPathFragments(
      libraryOptions.projectRoot,
      'src',
      'lib',
      componentOptions.flat ? '' : componentOptions.name
    ),
    nameAndDirectoryFormat: 'as-provided',
    standalone: true,
    export: true,
    skipFormat: true,
  });

  if (libraryOptions.routing) {
    if (libraryOptions.parent) {
      if (libraryOptions.lazy) {
        addLoadChildren(tree, libraryOptions);
      } else {
        addChildren(tree, libraryOptions);
      }
    }
  }
}
