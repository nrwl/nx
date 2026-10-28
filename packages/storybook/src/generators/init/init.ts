import { acknowledgeBuildScripts, addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  installPackagesTask,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { gte } from 'semver';
import { createNodesV2 } from '../../plugins/plugin';
import { getStorybookVersionToInstall } from '../../utils/utilities';
import { nxVersion } from '../../utils/versions';
import { assertSupportedStorybookVersion } from '../../utils/assert-supported-storybook-version';
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

  const storybookVersionToInstall = getStorybookVersionToInstall(host);
  devDependencies['storybook'] = storybookVersionToInstall;

  // storybook depends on esbuild, whose install script only validates the
  // prebuilt binary that ships as an optional dependency.
  acknowledgeBuildScripts(host, detectPackageManager(host.root), {
    esbuild: false,
  });

  return addDependenciesToPackageJson(
    host,
    {},
    devDependencies,
    undefined,
    schema.keepExistingVersions ?? true
  );
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
  return initGeneratorInternal(tree, schema);
}

export async function initGeneratorInternal(tree: Tree, schema: Schema) {
  assertSupportedStorybookVersion(tree);

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
      buildDepsTargetName: [
        'build-deps',
        'storybook:build-deps',
        'storybook-build-deps',
      ],
      watchDepsTargetName: [
        'watch-deps',
        'storybook:watch-deps',
        'storybook-watch-deps',
      ],
    },
    schema.updatePackageScripts
  );
  updateGitignore(tree);

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
