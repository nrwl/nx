import { ensurePackage, joinPathFragments, Tree } from '@nrwl/devkit';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {};
  }

  const { webStaticServeGenerator } = ensurePackage('@nrwl/web', nxVersion);
  await webStaticServeGenerator(host, {
    buildTarget: `${options.projectName}:build`,
    targetName: 'serve-static',
  });

  const { cypressProjectGenerator } = ensurePackage('@nrwl/cypress', nxVersion);

  return await cypressProjectGenerator(host, {
    ...options,
    name: options.e2eProjectName,
    directory: options.directory,
    project: options.projectName,
    rootProject: options.rootProject,
    bundler: options.bundler,
  });
}
