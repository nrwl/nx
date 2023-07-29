import type { Tree } from '@nx/devkit';
import { addChildren } from './add-children';
import { addLazyLoadedRouterConfiguration } from './add-lazy-loaded-router-configuration';
import { addLoadChildren } from './add-load-children';
import { addRouterConfiguration } from './add-router-configuration';
import { NormalizedSchema } from './normalized-schema';

export function addModule(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.routing && options.lazy) {
    addLazyLoadedRouterConfiguration(host, options);
  }
  if (options.routing && options.lazy && options.parent) {
    addLoadChildren(host, options);
  }
  if (options.routing && !options.lazy) {
    addRouterConfiguration(host, options);
  }
  if (options.routing && !options.lazy && options.parent) {
    addChildren(host, options);
  }
}
