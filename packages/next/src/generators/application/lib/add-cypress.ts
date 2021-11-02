import { cypressProjectGenerator } from '@nrwl/cypress';
import { Tree } from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';
import { Linter } from '@nrwl/linter';

export async function addCypress(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress') {
    return () => {};
  }

  return cypressProjectGenerator(host, {
    ...options,
    linter: Linter.EsLint,
    name: `${options.name}-e2e`,
    directory: options.directory,
    project: options.projectName,
  });
}
