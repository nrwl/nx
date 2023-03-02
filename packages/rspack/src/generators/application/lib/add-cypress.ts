import { ensurePackage, Tree } from '@nrwl/devkit';
import { version as nxVersion } from 'nx/package.json';
import { NormalizedSchema } from '../schema';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {
      //nothing
    };
  }
  await ensurePackage(host, '@nrwl/cypress', nxVersion);
  const { cypressProjectGenerator } = await import('@nrwl/cypress');

  return await cypressProjectGenerator(host, {
    ...options,
    name: options.rootProject ? `e2e` : `${options.name}-e2e`,
    project: options.name,
    rootProject: options.rootProject,
  });
}
