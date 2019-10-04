import { Schema } from './schema';
import { StrykerConfiguration } from './build';
import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { Observable, from, of } from 'rxjs';
import Stryker from '@stryker-mutator/core';
import { map, tap, catchError } from 'rxjs/operators';
import { json } from '@angular-devkit/core';

export function createStrykerRunner(
  options: Schema,
  { logger, workspaceRoot }: BuilderContext
): Observable<BuilderOutput> {
  const config = new StrykerConfiguration(logger, workspaceRoot).validateConfig(
    options
  );
  const strykerInstance = new Stryker(config);
  return from(strykerInstance.runMutationTest()).pipe(
    map(() => ({ success: true })),
    tap(() => logger.warn('Mutation Tests ran successfully')),
    catchError(e => {
      logger.error('Failed to ran mutation tests', e);
      return of({ success: false });
    })
  );
}

export default createBuilder<json.JsonObject & Schema>(createStrykerRunner);
