/**
 * For backwards compat.
 * TODO(jack): Remove in Nx 16.
 */
import { ExecutorContext } from '@nrwl/devkit';
import type { WebpackExecutorOptions } from '@nrwl/webpack';
import { webpackExecutor as baseWebpackExecutor } from '@nrwl/webpack';

export async function* webpackExecutor(
  options: WebpackExecutorOptions,
  context: ExecutorContext
) {
  yield* baseWebpackExecutor(
    {
      ...options,
      target: 'node',
      compiler: 'tsc',
    },
    context
  );
}

export default webpackExecutor;
