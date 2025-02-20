import { addE2e as addE2eReact } from '@nx/react/src/generators/application/lib/add-e2e';
import { GeneratorCallback, Tree, ensurePackage } from '@nx/devkit';

import { nxVersion } from '../../../utils/versions';

import { NormalizedSchema } from './normalize-options';

export async function addE2e(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  switch (options.e2eTestRunner) {
    case 'cypress':
      return addE2eReact(host, {
        ...options,
        e2eTestRunner: 'cypress',
        style: 'none',
        styledModule: null,
        hasStyles: false,
        unitTestRunner: 'none',
      });
    case 'playwright':
      return addE2eReact(host, {
        ...options,
        e2eTestRunner: 'playwright',
        style: 'none',
        styledModule: null,
        hasStyles: false,
        unitTestRunner: 'none',
      });
    case 'detox':
      const { detoxApplicationGenerator } = ensurePackage<
        typeof import('@nx/detox')
      >('@nx/detox', nxVersion);
      return detoxApplicationGenerator(host, {
        ...options,
        e2eName: options.e2eProjectName,
        e2eDirectory: options.e2eProjectRoot,
        appProject: options.projectName,
        appDisplayName: options.displayName,
        appName: options.name,
        framework: 'react-native',
        setParserOptionsProject: options.setParserOptionsProject,
        skipFormat: true,
      });
    case 'none':
    default:
      return () => {};
  }
}
