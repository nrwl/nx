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
    e2eName: `${options.name}-e2e`,
    e2eDirectory: options.directory,
    appProject: options.projectName,
    appDisplayName: options.displayName,
    appName: options.name,
    framework: 'react-native',
    skipFormat: true,
  });
}
