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
} from 'next/dist/next-server/lib/constants';
import startServer from 'next/dist/server/lib/start-server';
import NextServer from 'next/dist/server/next-dev-server';
import * as path from 'path';
import { from, Observable, of } from 'rxjs';
import { switchMap, concatMap, tap } from 'rxjs/operators';
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
  customServerPath: string;
}

export interface NextServerOptions {
  dev: boolean;
  dir: string;
  staticMarkup: boolean;
  quiet: boolean;
  conf: any;
  port: number;
  path: string;
}

export default createBuilder<NextBuildBuilderOptions>(run);

function defaultServer(settings: NextServerOptions) {
  return startServer(settings, settings.port).then(app => app.prepare());
}

function customServer(settings: NextServerOptions) {
  const nextApp = new NextServer(settings);

  return require(path.resolve(settings.dir, settings.path))(nextApp, settings);
}

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

          const settings = {
            dev: options.dev,
            dir: root,
            staticMarkup: options.staticMarkup,
            quiet: options.quiet,
            conf: config,
            port: options.port,
            path: options.customServerPath
          };

          const server = options.customServerPath
            ? customServer
            : defaultServer;

          return from(server(settings)).pipe(
            tap(() => {
              context.logger.info(`Ready on http://localhost:${settings.port}`);
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
