import {ModuleWithProviders, NgModule} from '@angular/core';
import {DataPersistence} from './data-persistence';

/**
 * @whatItDoes Provides services simplifying enterprise Angular development.
 */
@NgModule({})
export class NxModule {
  static forRoot(): ModuleWithProviders {
    return {ngModule: NxModule, providers: [DataPersistence]};
  }
}
