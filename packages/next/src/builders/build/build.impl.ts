import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import build from 'next/dist/build';
import { PHASE_PRODUCTION_BUILD } from 'next/dist/next-server/lib/constants';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { NextConfigPhase, prepareConfig } from '../../utils/config';
import { NextBuildBuilderOptions } from '../../utils/types';
import { createPackageJson } from './lib/create-package-json';

try {
  require('dotenv').config();
} catch (e) {}

export default createBuilder<NextBuildBuilderOptions>(run);

export interface AdditionalNextBuildOptions {
  addAdditionalNextConfig?: (
    phase: NextConfigPhase,
    config: Record<string, any>
  ) => Record<string, any>;
}

export function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext,
  additionalBuildOptions?: AdditionalNextBuildOptions
): Observable<BuilderOutput> {
  const root = path.resolve(context.workspaceRoot, options.root);
  let config = prepareConfig(PHASE_PRODUCTION_BUILD, options, context);
  if (additionalBuildOptions?.addAdditionalNextConfig) {
    config = additionalBuildOptions.addAdditionalNextConfig(
      PHASE_PRODUCTION_BUILD,
      config
    );
  }
  return from(build(root, config as any)).pipe(
    concatMap(() => from(createPackageJson(options, context))),
    map(() => ({ success: true }))
  );
}
