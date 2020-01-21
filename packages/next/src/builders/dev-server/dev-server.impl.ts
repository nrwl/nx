import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString
} from '@angular-devkit/architect';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER
} from 'next/dist/next-server/lib/constants';
import startServer from 'next/dist/server/lib/start-server';
import NextServer from 'next/dist/server/next-dev-server';
import * as path from 'path';
import { from, Observable, of } from 'rxjs';
import { concatMap, switchMap, tap } from 'rxjs/operators';
import { prepareConfig } from '../../utils/config';
import {
  NextBuildBuilderOptions,
  NextServeBuilderOptions
} from '../../utils/types';

try {
  require('dotenv').config();
} catch (e) {}

export interface NextServerOptions {
  dev: boolean;
  dir: string;
  staticMarkup: boolean;
  quiet: boolean;
  conf: any;
  port: number;
  path: string;
  hostname: string;
}

export default createBuilder<NextServeBuilderOptions>(run);

function defaultServer(settings: NextServerOptions) {
  return startServer(settings, settings.port, settings.hostname).then(app =>
    app.prepare()
  );
}

function customServer(settings: NextServerOptions) {
  const nextApp = new NextServer(settings);

  return require(path.resolve(settings.dir, settings.path))(nextApp, settings);
}

function run(
  options: NextServeBuilderOptions,
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
        concatMap((buildOptions: NextBuildBuilderOptions) => {
          const root = path.resolve(context.workspaceRoot, buildOptions.root);

          const config = prepareConfig(
            context.workspaceRoot,
            buildOptions.root,
            buildOptions.outputPath,
            buildOptions.fileReplacements,
            options.dev ? PHASE_DEVELOPMENT_SERVER : PHASE_PRODUCTION_SERVER
          );

          const settings = {
            dev: options.dev,
            dir: root,
            staticMarkup: options.staticMarkup,
            quiet: options.quiet,
            conf: config,
            port: options.port,
            path: options.customServerPath,
            hostname: options.hostname
          };

          const server = options.customServerPath
            ? customServer
            : defaultServer;

          return from(server(settings)).pipe(
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
