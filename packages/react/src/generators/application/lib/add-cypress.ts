import { ensurePackage, Tree } from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {};
  }

  await webStaticServeGenerator(host, {
    buildTarget: `${options.projectName}:build`,
    targetName: 'serve-static',
  });

  const { cypressProjectGenerator } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);

  return await cypressProjectGenerator(host, {
    ...options,
    name: options.e2eProjectName,
    directory: options.directory,
    project: options.projectName,
    bundler: options.bundler === 'rspack' ? 'webpack' : options.bundler,
    skipFormat: true,
  });
}
