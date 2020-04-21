import {
  BuilderContext,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { switchMap, concatMap } from 'rxjs/operators';
import { Schema } from './schema';
import { from } from 'rxjs';

try {
  require('dotenv').config();
} catch (e) {}

export interface NxPluginE2EBuilderOptions extends Schema {}

export default createBuilder(runNxPluginE2EBuilder);
export function runNxPluginE2EBuilder(
  options: NxPluginE2EBuilderOptions,
  context: BuilderContext
) {
  return buildTarget(context, options.target).pipe(
    switchMap(() => {
      return from(
        context.scheduleBuilder('@nrwl/jest:jest', {
          tsConfig: options.tsSpecConfig,
          jestConfig: options.jestConfig,
          watch: false,
        })
      ).pipe(concatMap((run) => run.output));
    })
  );
}

function buildTarget(context: BuilderContext, target: string) {
  return scheduleTargetAndForget(context, targetFromTargetString(target));
}
