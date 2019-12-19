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
import { from, Observable, of } from 'rxjs';
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
  customServerPath: string;
}

export default createBuilder<NextBuildBuilderOptions>(run);

/**
 * A simple default server implementation to be used if no `customServerPath` is provided.
 */
const defaultStartServer: StartServerFn = async (nextApp, options) => {
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  const server = http.createServer((req, res) => {
    handle(req, res);
  });
  return new Promise((resolve, reject) => {
    server.listen(options.port, error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

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

          const startServer: StartServerFn = options.customServerPath
            ? require(path.resolve(root, options.customServerPath))
            : defaultStartServer;

          return from(startServer(nextApp, options)).pipe(
            tap(() => {
              context.logger.info(`Ready on http://localhost:${options.port}`);
            }),
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
