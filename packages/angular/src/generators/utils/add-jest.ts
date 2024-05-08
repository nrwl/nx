import {
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  type Tree,
} from '@nx/devkit';
import { jestPresetAngularVersion, nxVersion } from '../../utils/versions';

export type AddJestOptions = {
  name: string;
  projectRoot: string;
  skipPackageJson: boolean;
  strict: boolean;
};

export async function addJest(
  tree: Tree,
  options: AddJestOptions
): Promise<void> {
  if (!options.skipPackageJson) {
    process.env.npm_config_legacy_peer_deps ??= 'true';

    addDependenciesToPackageJson(
      tree,
      {},
      { 'jest-preset-angular': jestPresetAngularVersion },
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
    addPlugin: false,
    addExplicitTargets: true,
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
      `// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
testEnvironmentOptions: {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
},
};
${contents}`
    );
  }
}
