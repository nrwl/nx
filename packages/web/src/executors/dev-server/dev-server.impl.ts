/**
 * This is here for backwards-compat.
 * TODO(jack): remove in Nx 16.
 */
import { ExecutorContext } from '@nrwl/devkit';

export async function* devServerExecutor(
  options: any,
  context: ExecutorContext
) {
  const { devServerExecutor: baseDevServerExecutor } = require('@nrwl/webpack');
  yield* baseDevServerExecutor(
    {
      ...options,
      target: 'web',
    },
    context
  );
}
export default devServerExecutor;
