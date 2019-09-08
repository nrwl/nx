import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  targetFromTargetString,
  scheduleTargetAndForget
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER
} from 'next-server/constants';
import startServer from 'next/dist/server/lib/start-server';
import * as path from 'path';
import { from, Observable, of } from 'rxjs';
import { switchMap, concatMap } from 'rxjs/operators';
import { prepareConfig } from '../../utils/config';

try {
  require('dotenv').config();
} catch (e) {}

export interface NextBuildBuilderOptions extends JsonObject {
  dev: boolean;
  port: number;
  staticMarkup: boolean;
  quiet: boolean;
  buildTarget: string;
}

export default createBuilder<NextBuildBuilderOptions>(run);

function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const buildTarget = targetFromTargetString(options.buildTarget);

  const build$ = !options.dev
    ? scheduleTargetAndForget(context, buildTarget)
    : of({ success: true });

  return build$.pipe(
    concatMap(r => {
      if (!r.success) return of(r);
      return from(context.getTargetOptions(buildTarget)).pipe(
        concatMap((buildOptions: any) => {
          const root = path.resolve(context.workspaceRoot, buildOptions.root);
          const config = prepareConfig(
            context.workspaceRoot,
            buildOptions.root,
            buildOptions.outputPath,
            options.dev ? PHASE_DEVELOPMENT_SERVER : PHASE_PRODUCTION_SERVER
          );

          return from(
            startServer(
              {
                dev: options.dev,
                dir: root,
                staticMarkup: options.staticMarkup,
                quiet: options.quiet,
                conf: config
              } as any,
              options.port
            ).then(app => app.prepare())
          ).pipe(
            switchMap(
              e =>
                new Observable<BuilderOutput>(obs => {
                  obs.next({
                    baseUrl: `http://localhost:${options.port}`,
                    success: true
                  });
                })
            )
          );
        })
      );
    })
  );
}
