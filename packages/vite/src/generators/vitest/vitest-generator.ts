import { Tree, logger } from '@nx/devkit';
import { ensurePackage } from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { VitestGeneratorSchema } from './schema';

/**
 * @deprecated Use `@nx/vitest:configuration` instead. This generator will be removed in Nx 23.
 */
export async function vitestGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema,
  hasPlugin = false,
  suppressDeprecationWarning = false
) {
  if (!suppressDeprecationWarning) {
    logger.warn(
      `The '@nx/vite:vitest' generator is deprecated. Please use '@nx/vitest:configuration' instead. This generator will be removed in Nx 23.`
    );
  }

  ensurePackage('@nx/vitest', nxVersion);
  const { configurationGenerator } = await import('@nx/vitest/generators');

  return await configurationGenerator(tree, schema, hasPlugin);
}

export default vitestGenerator;
