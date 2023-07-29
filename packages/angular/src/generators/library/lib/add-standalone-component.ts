import { Tree } from 'nx/src/generators/tree';
import { NormalizedSchema } from './normalized-schema';
import componentGenerator from '../../component/component';
import { addLoadChildren } from './add-load-children';
import { addChildren } from './add-children';

export async function addStandaloneComponent(
  tree: Tree,
  { libraryOptions, componentOptions }: NormalizedSchema
) {
  await componentGenerator(tree, {
    ...componentOptions,
    name: componentOptions.name,
    standalone: true,
    export: true,
    project: libraryOptions.name,
    flat: componentOptions.flat,
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
