import { ensurePackage, Tree } from '@nrwl/devkit';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {};
  }
  await ensurePackage(host, '@nrwl/cypress', nxVersion);
  const { cypressProjectGenerator } = await import('@nrwl/cypress');

  return await cypressProjectGenerator(host, {
    ...options,
    name: options.e2eProjectName,
    directory: options.directory,
    project: options.projectName,
    rootProject: options.rootProject,
  });
}
