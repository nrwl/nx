import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { PHASE_PRODUCTION_BUILD } from 'next/dist/next-server/lib/constants';
import build from 'next/dist/build';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { prepareConfig } from '../../utils/config';

try {
  require('dotenv').config();
} catch (e) {}

export interface NextBuildBuilderOptions extends JsonObject {
  root: string;
  outputPath: string;
}

export default createBuilder<NextBuildBuilderOptions>(run);

function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const root = path.resolve(context.workspaceRoot, options.root);
  const config = prepareConfig(
    context.workspaceRoot,
    options.root,
    options.outputPath,
    PHASE_PRODUCTION_BUILD
  );
  return from(build(root, config as any)).pipe(map(() => ({ success: true })));
}
