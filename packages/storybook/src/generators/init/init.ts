import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  detectPackageManager,
  GeneratorCallback,
  readJson,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import {
  litVersion,
  nxVersion,
  reactVersion,
  storybookVersion,
  storybookReactNativeVersion,
  viteVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import {
  getInstalledStorybookVersion,
  storybookMajorVersion,
} from '../../utils/utilities';
import { gte } from 'semver';

function checkDependenciesInstalled(host: Tree, schema: Schema) {
  const packageJson = readJson(host, 'package.json');

  const devDependencies = {};
  const dependencies = {};
  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.devDependencices = packageJson.devDependencices || {};

  // base deps
  devDependencies['@nx/storybook'] = nxVersion;

  let storybook7VersionToInstall = storybookVersion;
  if (
    storybookMajorVersion() === 7 &&
    getInstalledStorybookVersion() &&
    gte(getInstalledStorybookVersion(), '7.0.0')
  ) {
    storybook7VersionToInstall = getInstalledStorybookVersion();
  }

  // Needed for Storybook 7
  // https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-peer-dependencies-required
  if (
    !packageJson.dependencies['react'] &&
    !packageJson.devDependencies['react']
  ) {
    dependencies['react'] = reactVersion;
  }
  if (
    !packageJson.dependencies['react-dom'] &&
    !packageJson.devDependencies['react-dom']
  ) {
    dependencies['react-dom'] = reactVersion;
  }

  devDependencies['@storybook/core-server'] = storybook7VersionToInstall;
  devDependencies['@storybook/addon-essentials'] = storybook7VersionToInstall;

  if (schema.uiFramework) {
    if (schema.uiFramework === '@storybook/react-native') {
      devDependencies['@storybook/react-native'] = storybookReactNativeVersion;
    } else {
      devDependencies[schema.uiFramework] = storybook7VersionToInstall;
      const isPnpm = detectPackageManager(host.root) === 'pnpm';
      if (isPnpm) {
        // If it's pnpm, it needs the framework without the builder
        // as a dependency too (eg. @storybook/react)
        const matchResult = schema.uiFramework?.match(/^@storybook\/(\w+)/);
        const uiFrameworkWithoutBuilder = matchResult ? matchResult[0] : null;
        if (uiFrameworkWithoutBuilder) {
          devDependencies[uiFrameworkWithoutBuilder] =
            storybook7VersionToInstall;
        }
      }
    }

    if (schema.uiFramework === '@storybook/angular') {
      if (
        !packageJson.dependencies['@angular/forms'] &&
        !packageJson.devDependencies['@angular/forms']
      ) {
        devDependencies['@angular/forms'] = '*';
      }
    }

    if (
      schema.uiFramework === '@storybook/web-components-vite' ||
      schema.uiFramework === '@storybook/web-components-webpack5'
    ) {
      devDependencies['lit'] = litVersion;
    }

    if (schema.uiFramework === '@storybook/react-native') {
      devDependencies['@storybook/addon-ondevice-actions'] =
        storybookReactNativeVersion;
      devDependencies['@storybook/addon-ondevice-backgrounds'] =
        storybookReactNativeVersion;
      devDependencies['@storybook/addon-ondevice-controls'] =
        storybookReactNativeVersion;
      devDependencies['@storybook/addon-ondevice-notes'] =
        storybookReactNativeVersion;
    }

    if (schema.uiFramework.endsWith('-vite')) {
      if (
        !packageJson.dependencies['vite'] &&
        !packageJson.devDependencies['vite']
      ) {
        devDependencies['vite'] = viteVersion;
      }
    }
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

function addCacheableOperation(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (
    !nxJson.tasksRunnerOptions ||
    !nxJson.tasksRunnerOptions.default ||
    (nxJson.tasksRunnerOptions.default.runner !==
      '@nx/workspace/tasks-runners/default' &&
      nxJson.tasksRunnerOptions.default.runner !== 'nx/tasks-runners/default')
  ) {
    return;
  }

  nxJson.tasksRunnerOptions.default.options =
    nxJson.tasksRunnerOptions.default.options || {};

  nxJson.tasksRunnerOptions.default.options.cacheableOperations =
    nxJson.tasksRunnerOptions.default.options.cacheableOperations || [];
  if (
    !nxJson.tasksRunnerOptions.default.options.cacheableOperations?.includes(
      'build-storybook'
    )
  ) {
    nxJson.tasksRunnerOptions.default.options.cacheableOperations.push(
      'build-storybook'
    );
  }
  updateNxJson(tree, nxJson);
}

function moveToDevDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nx/storybook']) {
      packageJson.devDependencies['@nx/storybook'] =
        packageJson.dependencies['@nx/storybook'];
      delete packageJson.dependencies['@nx/storybook'];
    }
    return packageJson;
  });
}

/**
 * This is a temporary fix for Storybook to support TypeScript configuration files.
 * The issue is that if there is a root tsconfig.json file, Storybook will use it, and
 * ignore the tsconfig.json file in the .storybook folder. This results in module being set
 * to esnext, and Storybook does not recognise the main.ts code as a module.
 */
function editRootTsConfig(tree: Tree) {
  if (tree.exists('tsconfig.json')) {
    updateJson(tree, 'tsconfig.json', (json) => {
      if (json['ts-node']) {
        json['ts-node'] = {
          ...json['ts-node'],
          compilerOptions: {
            ...(json['ts-node'].compilerOptions ?? {}),
            module: 'commonjs',
          },
        };
      } else {
        json['ts-node'] = {
          compilerOptions: {
            module: 'commonjs',
          },
        };
      }
      return json;
    });
  }
}

export async function initGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
    })
  );
  tasks.push(checkDependenciesInstalled(tree, schema));
  moveToDevDependencies(tree);
  editRootTsConfig(tree);
  addCacheableOperation(tree);
  return runTasksInSerial(...tasks);
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
