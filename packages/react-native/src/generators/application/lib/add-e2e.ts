import { addE2e as addE2eReact } from '@nx/react/internal';
import { GeneratorCallback, Tree, ensurePackage, names } from '@nx/devkit';

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
        hasStyles: false,
        unitTestRunner: 'none',
        names: names(options.name),
      });
    case 'playwright':
      return addE2eReact(host, {
        ...options,
        e2eTestRunner: 'playwright',
        style: 'none',
        hasStyles: false,
        unitTestRunner: 'none',
        names: names(options.name),
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
        // Cross-plugin: map new flag to `setParserOptionsProject` for the
        // published @nx/detox.
        setParserOptionsProject:
          options.enableTypedLinting || options.setParserOptionsProject,
        enableTypedLinting: undefined,
        skipFormat: true,
      });
    case 'none':
    default:
      return () => {};
  }
}
