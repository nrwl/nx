/**
 * Note to developers: STOP! These exports end up as the public API of @nx/angular/src/utils.
 *
 * Try hard to not add to this API to reduce the surface area we need to maintain.
 */

export {
  isStandalone,
  addImportToComponent,
  addImportToDirective,
  addImportToPipe,
  addImportToModule,
  addProviderToBootstrapApplication,
  addProviderToAppConfig,
  addProviderToComponent,
  addProviderToModule,
  addViewProviderToComponent,
} from './nx-devkit/ast-utils';

export { addRoute, addProviderToRoute } from './nx-devkit/route-utils';
