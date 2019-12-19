import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import build from 'next/dist/build';
import * as path from 'path';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  return from(build(root)).pipe(map(() => ({ success: true })));
}
