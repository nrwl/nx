import {
  addDependenciesToPackageJson,
  detectPackageManager,
  readJson,
  type Tree,
} from '@nx/devkit';
import { coerce, gte } from 'semver';
import {
  getInstalledStorybookVersion,
  storybookMajorVersion,
} from '../../../utils/utilities';
import {
  litVersion,
  reactVersion,
  storybookVersion,
  viteVersion,
} from '../../../utils/versions';
import type { StorybookConfigureSchema } from '../schema';

export type EnsureDependenciesOptions = {
  uiFramework?: StorybookConfigureSchema['uiFramework'];
};

export function ensureDependencies(
  tree: Tree,
  options: EnsureDependenciesOptions
) {
  let storybookVersionToInstall = storybookVersion;
  const installedStorybookMajorVersion = storybookMajorVersion();
  if (
    installedStorybookMajorVersion >= 7 &&
    getInstalledStorybookVersion() &&
    gte(getInstalledStorybookVersion(), '7.0.0')
  ) {
    storybookVersionToInstall = getInstalledStorybookVersion();
  }

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> =
    installedStorybookMajorVersion < 9
      ? {
          '@storybook/core-server': storybookVersionToInstall,
          '@storybook/addon-essentials': storybookVersionToInstall,
        }
      : {};

  const packageJson = readJson(tree, 'package.json');
  packageJson.dependencies ??= {};
  packageJson.devDependencies ??= {};

  if (!gte(coerce(storybookVersionToInstall), '8.0.0')) {
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
  }

  if (options.uiFramework) {
    devDependencies[options.uiFramework] = storybookVersionToInstall;
    const isPnpm = detectPackageManager(tree.root) === 'pnpm';
    if (isPnpm) {
      // If it's pnpm, it needs the framework without the builder
      // as a dependency too (eg. @storybook/react)
      const matchResult = options.uiFramework?.match(/^@storybook\/(\w+)/);
      const uiFrameworkWithoutBuilder = matchResult ? matchResult[0] : null;
      if (uiFrameworkWithoutBuilder) {
        devDependencies[uiFrameworkWithoutBuilder] = storybookVersionToInstall;
      }
    }

    if (options.uiFramework === '@storybook/vue3-vite') {
      if (
        !packageJson.dependencies['@storybook/vue3'] &&
        !packageJson.devDependencies['@storybook/vue3']
      ) {
        devDependencies['@storybook/vue3'] = storybookVersionToInstall;
      }
    }

    if (options.uiFramework === '@storybook/angular') {
      if (
        !packageJson.dependencies['@angular/forms'] &&
        !packageJson.devDependencies['@angular/forms']
      ) {
        devDependencies['@angular/forms'] = '*';
      }
    }

    if (options.uiFramework === '@storybook/web-components-vite') {
      devDependencies['lit'] = litVersion;
    }

    if (options.uiFramework.endsWith('-vite')) {
      if (
        !packageJson.dependencies['vite'] &&
        !packageJson.devDependencies['vite']
      ) {
        devDependencies['vite'] = viteVersion;
      }
    }
  }

  return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
