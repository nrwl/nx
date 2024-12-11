import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { gte } from 'semver';
import { createNodesV2 } from '../../plugins/plugin';
import {
  getInstalledStorybookVersion,
  storybookMajorVersion,
} from '../../utils/utilities';
import { nxVersion, storybookVersion } from '../../utils/versions';
import { Schema } from './schema';
import { updateGitignore } from './lib/update-gitignore';

function checkDependenciesInstalled(
  host: Tree,
  schema: Schema
): GeneratorCallback {
  const devDependencies: Record<string, string> = {
    '@nx/storybook': nxVersion,
    '@nx/web': nxVersion,
  };

  let storybookVersionToInstall = storybookVersion;
  if (
    storybookMajorVersion() >= 7 &&
    getInstalledStorybookVersion() &&
    gte(getInstalledStorybookVersion(), '7.0.0')
  ) {
    storybookVersionToInstall = getInstalledStorybookVersion();
  }
  devDependencies['storybook'] = storybookVersionToInstall;

  return addDependenciesToPackageJson(
    host,
    {},
    devDependencies,
    undefined,
    schema.keepExistingVersions
  );
}

function addCacheableOperation(tree: Tree) {
  const nxJson = readNxJson(tree);
  const cacheableOperations: string[] | null =
    nxJson.tasksRunnerOptions?.default?.options?.cacheableOperations;

  if (cacheableOperations && !cacheableOperations.includes('build-storybook')) {
    nxJson.tasksRunnerOptions.default.options.cacheableOperations.push(
      'build-storybook'
    );
  }

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['build-storybook'] ??= {};
  nxJson.targetDefaults['build-storybook'].cache = true;

  updateNxJson(tree, nxJson);
}

function moveToDevDependencies(tree: Tree): GeneratorCallback {
  let updated = false;

  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nx/storybook']) {
      packageJson.devDependencies['@nx/storybook'] =
        packageJson.dependencies['@nx/storybook'];
      delete packageJson.dependencies['@nx/storybook'];
      updated = true;
    }

    return packageJson;
  });

  return updated ? () => installPackagesTask(tree) : () => {};
}

export function initGenerator(tree: Tree, schema: Schema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function initGeneratorInternal(tree: Tree, schema: Schema) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/storybook/plugin',
      createNodesV2,
      {
        serveStorybookTargetName: [
          'storybook',
          'serve:storybook',
          'serve-storybook',
          'storybook:serve',
          'storybook-serve',
        ],
        buildStorybookTargetName: [
          'build-storybook',
          'build:storybook',
          'storybook:build',
        ],
        testStorybookTargetName: [
          'test-storybook',
          'test:storybook',
          'storybook:test',
        ],
        staticStorybookTargetName: [
          'static-storybook',
          'static:storybook',
          'storybook:static',
        ],
      },
      schema.updatePackageScripts
    );
    updateGitignore(tree);
  } else {
    addCacheableOperation(tree);
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveToDevDependencies(tree));
    tasks.push(checkDependenciesInstalled(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
