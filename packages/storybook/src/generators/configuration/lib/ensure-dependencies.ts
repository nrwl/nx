import {
  addDependenciesToPackageJson,
  detectPackageManager,
  readJson,
  type Tree,
} from '@nx/devkit';
import { gte } from 'semver';
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
  let storybook7VersionToInstall = storybookVersion;
  if (
    storybookMajorVersion() >= 7 &&
    getInstalledStorybookVersion() &&
    gte(getInstalledStorybookVersion(), '7.0.0')
  ) {
    storybook7VersionToInstall = getInstalledStorybookVersion();
  }

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    '@storybook/core-server': storybook7VersionToInstall,
    '@storybook/addon-essentials': storybook7VersionToInstall,
  };

  const packageJson = readJson(tree, 'package.json');
  packageJson.dependencies ??= {};
  packageJson.devDependencies ??= {};

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

  if (options.uiFramework) {
    devDependencies[options.uiFramework] = storybook7VersionToInstall;
    const isPnpm = detectPackageManager(tree.root) === 'pnpm';
    if (isPnpm) {
      // If it's pnpm, it needs the framework without the builder
      // as a dependency too (eg. @storybook/react)
      const matchResult = options.uiFramework?.match(/^@storybook\/(\w+)/);
      const uiFrameworkWithoutBuilder = matchResult ? matchResult[0] : null;
      if (uiFrameworkWithoutBuilder) {
        devDependencies[uiFrameworkWithoutBuilder] = storybook7VersionToInstall;
      }
    }

    if (options.uiFramework === '@storybook/vue3-vite') {
      if (
        !packageJson.dependencies['@storybook/vue3'] &&
        !packageJson.devDependencies['@storybook/vue3']
      ) {
        devDependencies['@storybook/vue3'] = storybook7VersionToInstall;
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

    if (
      options.uiFramework === '@storybook/web-components-vite' ||
      options.uiFramework === '@storybook/web-components-webpack5'
    ) {
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
