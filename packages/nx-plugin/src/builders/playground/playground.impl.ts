import {
  createBuilder,
  BuilderContext,
  BuilderOutput,
  scheduleTargetAndForget,
  targetFromTargetString
} from '@angular-devkit/architect';
import { Observable, of } from 'rxjs';
import { Schema } from './schema';
import { switchMap, tap } from 'rxjs/operators';
import { ensureDirSync } from 'fs-extra';
import { appRootPath } from '@nrwl/workspace/src/utils/app-root';

interface PlaygroundOptions extends Schema {}

export default createBuilder(runPlaygroundBuilder);
export function runPlaygroundBuilder(
  options: PlaygroundOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  return buildTarget(context, options.target).pipe(
    switchMap(output => {
      return createPlayground(context);
    })
  );
}

function buildTarget(context: BuilderContext, target: string) {
  return scheduleTargetAndForget(context, targetFromTargetString(target));
}

function createPlayground(context: BuilderContext): Observable<BuilderOutput> {
  return new Observable(subscriber => {
    try {
      ensureDirSync(`${appRootPath}/tmp`);
    } catch {
      context.logger.fatal(`Could not create directory "${appRootPath}/tmp"`);
    }
  });
}
