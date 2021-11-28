import { detoxApplicationGenerator } from '@nrwl/detox';
import { Tree } from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';
import { Linter } from '@nrwl/linter';

export async function addDetox(host: Tree, options: NormalizedSchema) {
  if (options?.e2eTestRunner !== 'detox') {
    return () => {};
  }

  return detoxApplicationGenerator(host, {
    ...options,
    linter: Linter.EsLint,
    name: `${options.name}-e2e`,
    directory: options.directory,
    project: options.projectName,
    type: 'expo',
    setParserOptionsProject: options.setParserOptionsProject,
  });
}
