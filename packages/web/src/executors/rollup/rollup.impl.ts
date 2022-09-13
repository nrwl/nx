/**
 * This is here for backwards-compat.
 * TODO(jack): remove in Nx 16.
 */
import {
  rollupExecutor as _rollupExecutor,
  RollupExecutorOptions as WebRollupOptions,
} from '@nrwl/rollup';

export { WebRollupOptions };

export async function* rollupExecutor(options: any, context: any) {
  return yield* _rollupExecutor(
    {
      ...options,
      main: options.main || options.entryFile,
    },
    context
  );
}
export default rollupExecutor;
