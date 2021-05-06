import {
  BuilderContext,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { from } from 'rxjs';
import { concatMap, switchMap } from 'rxjs/operators';
import { Schema } from './schema';

try {
  require('dotenv').config();
  // eslint-disable-next-line no-empty
} catch (e) {}

export type NxPluginE2EBuilderOptions = Schema;

function buildTarget(context: BuilderContext, target: string) {
  return scheduleTargetAndForget(context, targetFromTargetString(target));
}

export function runNxPluginE2EBuilder(
  options: NxPluginE2EBuilderOptions,
  context: BuilderContext
) {
  return buildTarget(context, options.target).pipe(
    switchMap(() => {
      return from(
        context.scheduleBuilder('@nrwl/jest:jest', {
          jestConfig: options.jestConfig,
          watch: false,
        })
      ).pipe(concatMap((run) => run.output));
    })
  );
}

export default createBuilder(runNxPluginE2EBuilder);
