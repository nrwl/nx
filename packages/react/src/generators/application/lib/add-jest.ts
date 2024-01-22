import { ensurePackage, GeneratorCallback, Tree } from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addJest(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  if (options.unitTestRunner === 'none') {
    return () => {};
  }

  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );

  return await configurationGenerator(host, {
    ...options,
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: options.compiler,
    skipFormat: true,
  });
}
