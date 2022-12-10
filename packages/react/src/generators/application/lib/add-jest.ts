import { ensurePackage, Tree } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addJest(host: Tree, options: NormalizedSchema) {
  await ensurePackage(host, '@nrwl/jest', nxVersion);
  const { jestProjectGenerator } = await import('@nrwl/jest');

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
