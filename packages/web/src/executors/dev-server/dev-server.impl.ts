/**
 * This is here for backwards-compat.
 * TODO(v16): remove in Nx 16.
 */
import { ExecutorContext, logger } from '@nrwl/devkit';

export async function* devServerExecutor(
  options: any,
  context: ExecutorContext
) {
  const { devServerExecutor: baseDevServerExecutor } = require('@nrwl/webpack');
  logger.warn(
    '"@nrwl/web:dev-server" executor is deprecated. Use "@nrwl/webpack:dev-server" instead in your project.json.'
  );
  yield* baseDevServerExecutor(
    {
      ...options,
      target: 'web',
    },
    context
  );
}
export default devServerExecutor;
