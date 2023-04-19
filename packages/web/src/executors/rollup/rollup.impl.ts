/**
 * This is here for backwards-compat.
 * TODO(v16): remove in Nx 16.
 */
import {
  rollupExecutor as _rollupExecutor,
  RollupExecutorOptions as WebRollupOptions,
} from '@nx/rollup';
import { logger } from 'nx/src/utils/logger';

export { WebRollupOptions };

export async function* rollupExecutor(options: any, context: any) {
  logger.warn(
    '"@nx/web:rollup" executor is deprecated. Use "@nx/rollup:rollup" instead in your project.json.'
  );
  return yield* _rollupExecutor(
    {
      ...options,
      main: options.main || options.entryFile,
    },
    context
  );
}
export default rollupExecutor;
