import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  targetFromTargetString,
  scheduleTargetAndForget
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import * as http from 'http';
import next from 'next';
import * as path from 'path';
import { from, Observable, of, forkJoin } from 'rxjs';
import { switchMap, concatMap, tap } from 'rxjs/operators';
import { StartServerFn } from '../../..';

try {
  require('dotenv').config();
} catch (e) {}

export interface NextBuildBuilderOptions extends JsonObject {
  dev: boolean;
  port: number;
  quiet: boolean;
  buildTarget: string;
  customServerTarget: string;
}

export default createBuilder<NextBuildBuilderOptions>(run);

/**
 * A simple default server implementation to be used if no `customServerTarget` is provided.
 */
const defaultStartServer: StartServerFn = async (nextApp, options) => {
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  const server = http.createServer((req, res) => {
    handle(req, res);
  });
  return new Promise((resolve, reject) => {
    server.on('error', (error: Error) => {
      if (error) {
        reject(error);
      }
    });
    server.listen(options.port, () => {
      resolve();
    });
  });
};

function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const buildTarget = targetFromTargetString(options.buildTarget);
  const customServerTarget =
    options.customServerTarget &&
    targetFromTargetString(options.customServerTarget);

  const success: BuilderOutput = { success: true };
  const build$ = !options.dev
    ? scheduleTargetAndForget(context, buildTarget)
    : of(success);
  const customServer$ = customServerTarget
    ? scheduleTargetAndForget(context, customServerTarget)
    : of(success);

  return forkJoin(build$, customServer$).pipe(
    concatMap(([buildResult, customServerResult]) => {
      if (!buildResult.success) return of(buildResult);
      if (!customServerResult.success) return of(customServerResult);

      const customServerEntry = customServerResult.outfile;

      return from(context.getTargetOptions(buildTarget)).pipe(
        concatMap((buildOptions: JsonObject) => {
          const root = path.resolve(
            context.workspaceRoot,
            buildOptions.root as string
          );

          const nextApp = next({
            dev: options.dev,
            dir: root,
            quiet: options.quiet
          });

          let startServer: StartServerFn;
          if (customServerEntry) {
            startServer = require(customServerEntry as string).startServer;
          } else {
            startServer = defaultStartServer;
          }

          return from(startServer(nextApp, options)).pipe(
            tap(() => {
              context.logger.info(`Ready on http://localhost:${options.port}`);
            }),
            switchMap(
              _e =>
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
