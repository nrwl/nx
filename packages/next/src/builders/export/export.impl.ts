import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  targetFromTargetString,
  scheduleTargetAndForget
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import exportApp from 'next/dist/export';
import * as path from 'path';
import { from, Observable, of } from 'rxjs';
import { map, concatMap } from 'rxjs/operators';

try {
  require('dotenv').config();
} catch (e) {}

export interface NextBuildBuilderOptions extends JsonObject {
  buildTarget: string;
  silent: boolean;
  threads: number;
  concurrency: number;
}

export default createBuilder<NextBuildBuilderOptions>(run);

function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const buildTarget = targetFromTargetString(options.buildTarget);
  const build$ = scheduleTargetAndForget(context, buildTarget);

  return build$.pipe(
    concatMap(r => {
      if (!r.success) return of(r);
      return from(context.getTargetOptions(buildTarget)).pipe(
        concatMap((buildOptions: any) => {
          const root = path.resolve(context.workspaceRoot, buildOptions.root);
          return from(
            exportApp(root, {
              silent: options.silent,
              threads: options.threads,
              concurrency: options.concurrency,
              outdir: `${buildOptions.outputPath}/exported`
            } as any)
          ).pipe(map(() => ({ success: true })));
        })
      );
    })
  );
}
