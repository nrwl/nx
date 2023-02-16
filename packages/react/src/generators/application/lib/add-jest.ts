import { ensurePackage, GeneratorCallback, Tree } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addJest(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const { jestProjectGenerator } = ensurePackage('@nrwl/jest', nxVersion);

  if (options.unitTestRunner !== 'jest') {
    return () => {};
  }

  return await jestProjectGenerator(host, {
    ...options,
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: options.compiler,
    rootProject: options.rootProject,
  });
}
