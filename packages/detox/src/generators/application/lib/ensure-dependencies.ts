import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import { versions } from '@nx/jest/src/utils/versions';
import {
  configPluginsDetoxVersion,
  testingLibraryJestDom,
} from '../../../utils/versions';
import type { NormalizedSchema } from './normalize-options';

export function ensureDependencies(tree: Tree, options: NormalizedSchema) {
  const { jestVersion, typesNodeVersion } = versions(tree);

  const devDependencies: Record<string, string> = {
    '@testing-library/jest-dom': testingLibraryJestDom,
    '@types/node': typesNodeVersion,
    'jest-circus': jestVersion,
  };

  if (options.framework === 'expo') {
    devDependencies['@config-plugins/detox'] = configPluginsDetoxVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}
