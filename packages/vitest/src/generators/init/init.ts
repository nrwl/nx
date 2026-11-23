import { acknowledgeBuildScripts, addPlugin } from '@nx/devkit/internal';
import {
  type Tree,
  type GeneratorCallback,
  detectPackageManager,
  readNxJson,
  addDependenciesToPackageJson,
  formatFiles,
  runTasksInSerial,
  updateNxJson,
  createProjectGraphAsync,
} from '@nx/devkit';
import { coerce } from 'semver';
import { InitGeneratorSchema } from './schema';
import {
  nxVersion,
  versions,
  viteV5Version,
  viteV6Version,
  viteV7Version,
  viteVersion,
} from '../../utils/versions';
import { createNodesV2 } from '../../plugins/plugin';
import { getInstalledViteMajorVersion } from '../../utils/version-utils';
import { ignoreVitestTempFiles } from '../../utils/ignore-vitest-temp-files';
import { assertSupportedVitestVersion } from '../../utils/assert-supported-vitest-version';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  // Determine which vite version to install:
  // 1. Explicit viteVersion flag takes priority
  // 2. If vite is already installed, keep the matching major version
  // 3. Otherwise, use the latest default (^8.0.0)
  const installedMajor =
    schema.viteVersion ?? getInstalledViteMajorVersion(tree);
  const viteVersionToUse =
    installedMajor === 5
      ? viteV5Version
      : installedMajor === 6
        ? viteV6Version
        : installedMajor === 7
          ? viteV7Version
          : viteVersion;

  // Vite below 8 depends on esbuild (8 bundles rolldown instead), whose install
  // script only validates the prebuilt binary that ships as an optional
  // dependency.
  const viteSemver = coerce(viteVersionToUse);
  if (viteSemver && viteSemver.major < 8) {
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      esbuild: false,
    });
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/vitest': nxVersion,
      // The range about to be installed is passed for the case where the
      // workspace has no vite of its own; it constrains the vitest major.
      vitest: versions(tree, { viteRange: viteVersionToUse }).vitestVersion,
      vite: viteVersionToUse,
    },
    undefined,
    schema.keepExistingVersions ?? true
  );
}

export function updateNxJsonSettings(tree: Tree) {
  const nxJson = readNxJson(tree) ?? {};

  const { namedInputs } = nxJson;
  const productionFileSet = namedInputs?.production;
  if (namedInputs && productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    namedInputs.production = Array.from(new Set(productionFileSet));
  }

  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  assertSupportedVitestVersion(tree);

  await addPlugin(
    tree,
    await createProjectGraphAsync(),
    '@nx/vitest',
    createNodesV2,
    {
      testTargetName: ['test', 'vitest:test', 'vitest-test'],
      ciTargetName: ['test-ci', 'vitest:test-ci', 'vitest-test-ci'],
    },
    schema.updatePackageScripts ?? false
  );

  updateNxJsonSettings(tree);
  await ignoreVitestTempFiles(tree, schema.projectRoot);

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(updateDependencies(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
