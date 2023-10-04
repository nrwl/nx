/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use our own StylesheetProcessor instead of the one provided by ng-packagr.
 */

import { FactoryProvider, InjectionToken } from 'injection-js';
import { StylesheetProcessor } from './stylesheet-processor';

export const NX_STYLESHEET_PROCESSOR_TOKEN =
  new InjectionToken<StylesheetProcessor>(`nx.v1.stylesheetProcessor`);

export const NX_STYLESHEET_PROCESSOR: FactoryProvider = {
  provide: NX_STYLESHEET_PROCESSOR_TOKEN,
  useFactory: () => StylesheetProcessor,
  deps: [],
};
