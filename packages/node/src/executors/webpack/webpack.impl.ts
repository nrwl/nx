/**
 * For backwards compat.
 * TODO(v16): Remove in Nx 16.
 */
import { ExecutorContext, logger } from '@nrwl/devkit';
import type { WebpackExecutorOptions } from '@nrwl/webpack';
import { webpackExecutor as baseWebpackExecutor } from '@nrwl/webpack';

export async function* webpackExecutor(
  options: WebpackExecutorOptions,
  context: ExecutorContext
) {
  logger.warn(
    '"@nrwl/node:webpack" executor is deprecated. Use "@nrwl/webpack:webpack" instead in your project.json.'
  );
  yield* baseWebpackExecutor(
    {
      ...options,
      target: 'node',
      compiler: 'tsc',
      scripts: [],
      styles: [],
    },
    context
  );
}

export default webpackExecutor;
