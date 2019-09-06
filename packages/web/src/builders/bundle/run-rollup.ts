import * as rollup from 'rollup';
import { from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export function runRollup(options: rollup.RollupOptions) {
  return from(rollup.rollup(options)).pipe(
    switchMap(bundle => from(bundle.write(options.output))),
    map(() => ({ success: true })),
    catchError(e => {
      console.error(e);
      return of({ success: false });
    })
  );
}
