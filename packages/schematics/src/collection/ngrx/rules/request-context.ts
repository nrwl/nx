import * as path from 'path';
import { Schema } from '../schema';
import * as stringUtils from '../../../utils/strings';

/**
 * Schematic request context
 */
export interface RequestContext {
  featureName: string;
  moduleDir: string;
  options?: Schema;
}

export function buildNameToNgrxFile(context: RequestContext, suffice: string) {
  return path.join(
    context.moduleDir,
    context.options.directory,
    `${stringUtils.dasherize(context.featureName)}.${suffice}`
  );
}
