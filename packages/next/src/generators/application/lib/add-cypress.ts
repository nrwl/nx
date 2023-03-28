import { ensurePackage, Tree } from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {};
  }

  const { cypressProjectGenerator } = ensurePackage<
    typeof import('@nrwl/cypress')
  >('@nrwl/cypress', nxVersion);
  return cypressProjectGenerator(host, {
    ...options,
    linter: Linter.EsLint,
    name: `${options.name}-e2e`,
    directory: options.directory,
    project: options.projectName,
  });
}
