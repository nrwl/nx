import { ExecutorContext, logger } from '@nx/devkit';
import { ensurePackage } from '@nx/devkit';
import { nxVersion } from '../../utils/versions.js';
import { VitestExecutorOptions } from './schema.js';

/**
 * @deprecated Use `@nx/vitest:test` instead. This executor will be removed in Nx 23.
 */
export async function* vitestExecutor(
  options: VitestExecutorOptions,
  context: ExecutorContext
) {
  logger.warn(
    `The '@nx/vite:test' executor is deprecated. Please use '@nx/vitest:test' instead. This executor will be removed in Nx 23.`
  );

  ensurePackage('@nx/vitest', nxVersion);
  const { vitestExecutor: actualVitestExecutor } = await import(
    '@nx/vitest/executors'
  );

  yield* actualVitestExecutor(options, context);
}

export default vitestExecutor;
