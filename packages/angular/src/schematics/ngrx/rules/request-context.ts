import * as path from 'path';

import { Tree } from '@angular-devkit/schematics';
import { Schema } from '../schema';
import { stringUtils } from '@nrwl/workspace';

/**
 * Schematic request context
 */
export interface RequestContext {
  featureName: string;
  moduleDir: string;
  options?: Schema;
  host?: Tree;
}

export function buildNameToNgrxFile(context: RequestContext, suffice: string) {
  return path.join(
    context.moduleDir,
    context.options.directory,
    `${stringUtils.dasherize(context.featureName)}.${suffice}`
  );
}
