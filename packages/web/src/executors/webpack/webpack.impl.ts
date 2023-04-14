/**
 * For backwards compat.
 * TODO(v16): Remove in Nx 16.
 */
import { ExecutorContext, logger } from '@nx/devkit';

export async function* webpackExecutor(options: any, context: ExecutorContext) {
  const { webpackExecutor: baseWebpackExecutor } = require('@nx/webpack');
  logger.warn(
    '"@nx/web:webpack" executor is deprecated. Use "@nx/webpack:webpack" instead in your project.json.'
  );
  yield* baseWebpackExecutor(
    {
      ...options,
      target: 'web',
    },
    context
  );
}

export default webpackExecutor;
