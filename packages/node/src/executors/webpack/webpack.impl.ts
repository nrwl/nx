/**
 * For backwards compat.
 * TODO(v16): Remove in Nx 16.
 */
import { ExecutorContext, logger } from '@nx/devkit';
import type { WebpackExecutorOptions } from '@nx/webpack';
import { webpackExecutor as baseWebpackExecutor } from '@nx/webpack';

export async function* webpackExecutor(
  options: WebpackExecutorOptions,
  context: ExecutorContext
) {
  logger.warn(
    '"@nx/node:webpack" executor is deprecated. Use "@nx/webpack:webpack" instead in your project.json.'
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
