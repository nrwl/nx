/**
 * For backwards compat.
 * TODO(v16): Remove in Nx 16.
 */
import { ExecutorContext, logger } from '@nrwl/devkit';

export async function* webpackExecutor(options: any, context: ExecutorContext) {
  const { webpackExecutor: baseWebpackExecutor } = require('@nrwl/webpack');
  logger.warn(
    '"@nrwl/web:webpack" executor is deprecated. Use "@nrwl/webpack:webpack" instead in your project.json.'
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
