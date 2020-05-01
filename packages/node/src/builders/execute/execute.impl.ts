import {
  BuilderContext,
  createBuilder,
  BuilderOutput,
  targetFromTargetString,
  scheduleTargetAndForget,
} from '@angular-devkit/architect';
import { ChildProcess, fork } from 'child_process';
import * as treeKill from 'tree-kill';

import { Observable, bindCallback, of, zip, from, iif } from 'rxjs';
import { concatMap, tap, mapTo, first, map, filter } from 'rxjs/operators';

import { NodeBuildEvent } from '../build/build.impl';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { JsonObject } from '@angular-devkit/core';

try {
  require('dotenv').config();
} catch (e) {}

export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk',
}

export interface NodeExecuteBuilderOptions extends JsonObject {
  inspect: boolean | InspectType;
  runtimeArgs: string[];
  args: string[];
  waitUntilTargets: string[];
  buildTarget: string;
  host: string;
  port: number;
  watch: boolean;
}

export default createBuilder<NodeExecuteBuilderOptions>(
  nodeExecuteBuilderHandler
);

let subProcess: ChildProcess = null;

export function nodeExecuteBuilderHandler(
  options: NodeExecuteBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  return runWaitUntilTargets(options, context).pipe(
    concatMap((v) => {
      if (!v.success) {
        context.logger.error(
          `One of the tasks specified in waitUntilTargets failed`
        );
        return of({ success: false });
      }
      return startBuild(options, context).pipe(
        concatMap((event: NodeBuildEvent) => {
          if (!event.success) {
            context.logger.error(
              'There was an error with the build. See above.'
            );
            context.logger.info(`${event.outfile} was not restarted.`);
          }

          return handleBuildEvent(event, options, context).pipe(mapTo(event));
        })
      );
    })
  );
}

function runProcess(event: NodeBuildEvent, options: NodeExecuteBuilderOptions) {
  if (subProcess || !event.success) return;

  subProcess = fork(event.outfile, options.args, {
    execArgv: getExecArgv(options),
  });
}

function getExecArgv(options: NodeExecuteBuilderOptions) {
  const args = ['-r', 'source-map-support/register', ...options.runtimeArgs];

  if (options.inspect === true) {
    options.inspect = InspectType.Inspect;
  }

  if (options.inspect) {
    args.push(`--${options.inspect}=${options.host}:${options.port}`);
  }

  return args;
}

function handleBuildEvent(
  event: NodeBuildEvent,
  options: NodeExecuteBuilderOptions,
  context: BuilderContext
) {
  return iif(
    () => !event.success || options.watch,
    killProcess(context),
    of(undefined)
  ).pipe(tap(() => runProcess(event, options)));
}

function killProcess(context: BuilderContext): Observable<void | Error> {
  if (!subProcess) {
    return of(undefined);
  }

  const observableTreeKill = bindCallback<number, string, Error>(treeKill);
  return observableTreeKill(subProcess.pid, 'SIGTERM').pipe(
    tap((err) => {
      subProcess = null;
      if (err) {
        if (Array.isArray(err) && err[0] && err[2]) {
          const errorMessage = err[2];
          context.logger.error(errorMessage);
        } else if (err.message) {
          context.logger.error(err.message);
        }
      }
    })
  );
}

function startBuild(
  options: NodeExecuteBuilderOptions,
  context: BuilderContext
): Observable<NodeBuildEvent> {
  const target = targetFromTargetString(options.buildTarget);
  return from(
    Promise.all([
      context.getTargetOptions(target),
      context.getBuilderNameForTarget(target),
    ]).then(([options, builderName]) =>
      context.validateOptions(options, builderName)
    )
  ).pipe(
    tap((options) => {
      if (options.optimization) {
        context.logger.warn(stripIndents`
            ************************************************
            This is a simple process manager for use in
            testing or debugging Node applications locally.
            DO NOT USE IT FOR PRODUCTION!
            You should look into proper means of deploying
            your node application to production.
            ************************************************`);
      }
    }),
    concatMap(
      (options) =>
        scheduleTargetAndForget(context, target, {
          ...options,
          watch: true,
        }) as Observable<NodeBuildEvent>
    )
  );
}

function runWaitUntilTargets(
  options: NodeExecuteBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  if (!options.waitUntilTargets || options.waitUntilTargets.length === 0)
    return of({ success: true });

  return zip(
    ...options.waitUntilTargets.map((b) => {
      return scheduleTargetAndForget(context, targetFromTargetString(b)).pipe(
        filter((e) => e.success !== undefined),
        first()
      );
    })
  ).pipe(
    map((results) => {
      return { success: !results.some((r) => !r.success) };
    })
  );
}
