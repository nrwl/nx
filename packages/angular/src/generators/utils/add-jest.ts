import {
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { getInstalledAngularVersionInfo, versions } from './version-utils';

export type AddJestOptions = {
  name: string;
  projectRoot: string;
  skipPackageJson: boolean;
  strict: boolean;
  addPlugin?: boolean;
};

export async function addJest(
  tree: Tree,
  options: AddJestOptions
): Promise<void> {
  if (!options.skipPackageJson) {
    const pkgVersions = versions(tree);
    const devDependencies: Record<string, string> = {
      'jest-preset-angular': pkgVersions.jestPresetAngularVersion,
    };
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

    if (angularMajorVersion < 21) {
      // force jest v29.7.0
      devDependencies.jest = '^29.7.0';
    }

    addDependenciesToPackageJson(
      tree,
      {
        // TODO(leo): jest-preset-angular still needs this, it has it as a peer dependency
        '@angular/platform-browser-dynamic': pkgVersions.angularVersion,
      },
      devDependencies,
      undefined,
      true
    );
  }

  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );
  await configurationGenerator(tree, {
    project: options.name,
    setupFile: 'angular',
    supportTsx: false,
    skipSerializers: false,
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    addPlugin: options.addPlugin ?? false,
    addExplicitTargets: !options.addPlugin,
  });

  const setupFile = joinPathFragments(
    options.projectRoot,
    'src',
    'test-setup.ts'
  );
  if (options.strict && tree.exists(setupFile)) {
    const contents = tree.read(setupFile, 'utf-8');
    tree.write(
      setupFile,
      contents.replace(
        'setupZoneTestEnv();',
        `setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true
});`
      )
    );
  }
}
