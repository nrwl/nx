import { ExecutorContext, logger } from '@nx/devkit';
import { ensurePackage } from '@nx/devkit/src/utils/package-manager';
import { nxVersion } from '../../utils/versions';
import { VitestExecutorOptions } from './schema';

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

  const { vitestExecutor: actualVitestExecutor } = ensurePackage<
    typeof import('@nx/vitest')
  >('@nx/vitest', nxVersion);

  yield* actualVitestExecutor(options, context);
}

export default vitestExecutor;
