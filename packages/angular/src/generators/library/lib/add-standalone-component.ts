import { joinPathFragments, names, type Tree } from '@nx/devkit';
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
    name: names(libraryOptions.name).className,
    path: joinPathFragments(
      libraryOptions.projectRoot,
      'src',
      'lib',
      componentOptions.flat
        ? `${componentOptions.name}`
        : `${componentOptions.name}/${componentOptions.name}`
    ),
    standalone: true,
    export: true,
    type: componentOptions.type,
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
