import { chain, noop, Rule } from '@angular-devkit/schematics';
import { addChildren } from './add-children';
import { addLazyLoadedRouterConfiguration } from './add-lazy-loaded-router-configuration';
import { addLoadChildren } from './add-load-children';
import { addRouterConfiguration } from './add-router-configuration';
import { NormalizedSchema } from './normalized-schema';

export function addModule(options: NormalizedSchema): Rule {
  return chain([
    options.routing && options.lazy
      ? addLazyLoadedRouterConfiguration(options)
      : noop(),
    options.routing && options.lazy && options.parentModule
      ? addLoadChildren(options)
      : noop(),
    options.routing && !options.lazy ? addRouterConfiguration(options) : noop(),
    options.routing && !options.lazy && options.parentModule
      ? addChildren(options)
      : noop(),
  ]);
}
