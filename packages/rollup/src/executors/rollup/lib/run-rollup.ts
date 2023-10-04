import * as rollup from 'rollup';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export function runRollup(options: rollup.RollupOptions) {
  return from(rollup.rollup(options)).pipe(
    switchMap((bundle) => {
      const outputOptions = Array.isArray(options.output)
        ? options.output
        : [options.output];
      return from(
        Promise.all(
          (<Array<rollup.OutputOptions>>outputOptions).map((o) =>
            bundle.write(o)
          )
        )
      );
    }),
    map(() => ({ success: true }))
  );
}
