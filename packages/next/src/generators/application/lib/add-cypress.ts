import { ensurePackage, Tree } from '@nx/devkit';
import { Linter } from '@nx/linter';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {};
  }

  const { cypressProjectGenerator } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);
  return cypressProjectGenerator(host, {
    ...options,
    linter: Linter.EsLint,
    name: options.e2eProjectName,
    directory: options.directory,
    project: options.projectName,
    skipFormat: true,
  });
}
