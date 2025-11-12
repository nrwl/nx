import {
  addDependenciesToPackageJson,
  ensurePackage,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions.js';
import { getInstalledAngularDevkitVersion, versions } from './version-utils.js';

export type AddVitestOptions = {
  name: string;
  projectRoot: string;
  skipPackageJson: boolean;
  strict: boolean;
  addPlugin?: boolean;
};

export async function addVitest(
  tree: Tree,
  options: AddVitestOptions
): Promise<void> {
  ensurePackage('@nx/vitest', nxVersion);
  const { configurationGenerator } = await import('@nx/vitest/generators');

  await configurationGenerator(tree, {
    project: options.name,
    uiFramework: 'angular',
    testEnvironment: 'jsdom',
    coverageProvider: 'v8',
    addPlugin: options.addPlugin ?? false,
  });

  if (!options.skipPackageJson) {
    const angularDevkitVersion =
      getInstalledAngularDevkitVersion(tree) ??
      versions(tree).angularDevkitVersion;

    addDependenciesToPackageJson(
      tree,
      {},
      { '@angular/build': angularDevkitVersion },
      undefined,
      true
    );
  }
}
