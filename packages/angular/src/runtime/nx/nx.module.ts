import { ModuleWithProviders, NgModule } from '@angular/core';
import { DataPersistence } from './data-persistence';

/**
 * @whatItDoes Provides services for enterprise Angular applications.
 *
 * See {@link DataPersistence} for more information.
 *
 * @deprecated Use the individual operators instead. Will be removed in v15.
 */
@NgModule({})
export class NxModule {
  static forRoot(): ModuleWithProviders<NxModule> {
    return { ngModule: NxModule, providers: [DataPersistence] };
  }
}
