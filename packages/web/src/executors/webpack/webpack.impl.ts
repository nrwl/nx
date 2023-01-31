/**
 * For backwards compat.
 * TODO(jack): Remove in Nx 16.
 */
import { ExecutorContext } from '@nrwl/devkit';

export async function* webpackExecutor(options: any, context: ExecutorContext) {
  const { webpackExecutor: baseWebpackExecutor } = require('@nrwl/webpack');
  yield* baseWebpackExecutor(
    {
      ...options,
      target: 'web',
    },
    context
  );
}

export default webpackExecutor;
