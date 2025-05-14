import {
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { versions } from './version-utils';

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
    process.env.npm_config_legacy_peer_deps ??= 'true';

    const pkgVersions = versions(tree);
    addDependenciesToPackageJson(
      tree,
      {
        // TODO(leo): jest-preset-angular still needs this until https://github.com/thymikee/jest-preset-angular/pull/3079 is merged
        '@angular/platform-browser-dynamic': pkgVersions.angularVersion,
      },
      { 'jest-preset-angular': pkgVersions.jestPresetAngularVersion },
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
