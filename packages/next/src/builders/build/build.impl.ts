import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import build from 'next/dist/build';
import { PHASE_PRODUCTION_BUILD } from 'next/dist/next-server/lib/constants';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { prepareConfig } from '../../utils/config';
import { NextBuildBuilderOptions } from '../../utils/types';

try {
  require('dotenv').config();
} catch (e) {}

export default createBuilder<NextBuildBuilderOptions>(run);

export function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const root = path.resolve(context.workspaceRoot, options.root);
  const config = prepareConfig(
    context.workspaceRoot,
    options.root,
    options.outputPath,
    options.fileReplacements,
    PHASE_PRODUCTION_BUILD
  );
  return from(build(root, config as any)).pipe(map(() => ({ success: true })));
}
