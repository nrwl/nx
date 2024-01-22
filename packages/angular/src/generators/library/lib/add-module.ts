import type { Tree } from '@nx/devkit';
import { addChildren } from './add-children';
import { addLoadChildren } from './add-load-children';
import { NormalizedSchema } from './normalized-schema';

export function addModule(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.routing && options.lazy && options.parent) {
    addLoadChildren(host, options);
  }
  if (options.routing && !options.lazy && options.parent) {
    addChildren(host, options);
  }
}
