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

try {
  require('dotenv').config();
} catch (e) {}

type NextServer = ReturnType<typeof next>;

/**
 * If a `customServerTarget` is specified, it's assumed to export a `StartServerFn` function.
 * Nx will call this function when dev-server command is run. This function should call
 * `nextApp.prepare()`, and then start an HTTP server on the given `settings.port`.
 */
export type StartServerFn = (
  nextApp: NextServer,
  settings: NextBuildBuilderOptions
) => Promise<void>;

export interface NextBuildBuilderOptions extends JsonObject {
  dev: boolean;
  port: number;
  quiet: boolean;
  buildTarget: string;
  customServerPath: string;
  hostname: string;
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
    server.on('error', (error: Error) => {
      reject(error);
    });
    if (options.hostname) {
      server.listen(options.port, options.hostname, () => {
        resolve();
      });
    } else {
      server.listen(options.port, () => {
        resolve();
      });
    }
  });
};

function run(
  options: NextBuildBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const buildTarget = targetFromTargetString(options.buildTarget);
  const baseUrl = `http://${options.hostname || 'localhost'}:${options.port}`;

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
              context.logger.info(`Ready on ${baseUrl}`);
            }),
            switchMap(
              e =>
                new Observable<BuilderOutput>(obs => {
                  obs.next({
                    baseUrl,
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
