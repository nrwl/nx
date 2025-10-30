import { Tree, logger } from '@nx/devkit';
import { ensurePackage } from '@nx/devkit/src/utils/package-manager';
import { nxVersion } from '../../utils/versions';
import { VitestGeneratorSchema } from './schema';

/**
 * @deprecated Use `@nx/vitest:configuration` instead. This generator will be removed in Nx 23.
 */
export async function vitestGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema,
  hasPlugin = false
) {
  logger.warn(
    `The '@nx/vite:vitest' generator is deprecated. Please use '@nx/vitest:configuration' instead. This generator will be removed in Nx 23.`
  );

  const { configurationGenerator } = ensurePackage<typeof import('@nx/vitest')>(
    '@nx/vitest',
    nxVersion
  );

  return await configurationGenerator(tree, schema, hasPlugin);
}

export default vitestGenerator;
