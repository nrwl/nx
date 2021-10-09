import { GeneratorCallback, readJson, Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  logger,
  removeDependenciesFromPackageJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
  migrateStorybookToWebPack5,
  workspaceHasStorybookForReact,
} from './storybook-webpack5-changes';

const basePackages = {
  'copy-webpack-plugin': '^9.0.1',
  webpack: '^5.47.0',
  'webpack-merge': '^5.8.0',
  'webpack-node-externals': '^3.0.0',
};

const webPackages = {
  'mini-css-extract-plugin': '^2.1.0',
  'source-map-loader': '^3.0.0',
  'terser-webpack-plugin': '^5.1.1',
  'webpack-dev-server': '4.0.0-rc.0',
  'webpack-sources': '^3.0.2',
  'react-refresh': '^0.10.0',
  '@pmmmwh/react-refresh-webpack-plugin': '0.5.0-rc.2',
};

export async function webMigrateToWebpack5Generator(tree: Tree, schema: {}) {
  const packages = { ...basePackages, ...webPackages };
  const tasks: GeneratorCallback[] = [];
  const packageJson = readJson(tree, 'package.json');

  logger.info(`NX Adding webpack 5 to workspace.`);

  // Removing the packages ensures that the versions will be updated when adding them after
  tasks.push(
    removeDependenciesFromPackageJson(tree, [], Object.keys(packages))
  );

  // Here, if our workspace has Storybook for React, we add the Storybook webpack 5 dependencies
  if (workspaceHasStorybookForReact(packageJson)) {
    if (
      !(
        packageJson.dependencies['@storybook/builder-webpack5'] ||
        packageJson.devDependencies['@storybook/builder-webpack5']
      )
    ) {
      packages['@storybook/builder-webpack5'] =
        workspaceHasStorybookForReact(packageJson);
    }
    if (
      !(
        packageJson.dependencies['@storybook/manager-webpack5'] ||
        packageJson.devDependencies['@storybook/manager-webpack5']
      )
    ) {
      packages['@storybook/manager-webpack5'] =
        workspaceHasStorybookForReact(packageJson);
    }
    await migrateStorybookToWebPack5(tree);
  }

  tasks.push(addDependenciesToPackageJson(tree, {}, packages));

  return runTasksInSerial(...tasks);
}

export default webMigrateToWebpack5Generator;
export const webMigrateToWebpack5Schematic = convertNxGenerator(
  webMigrateToWebpack5Generator
);
