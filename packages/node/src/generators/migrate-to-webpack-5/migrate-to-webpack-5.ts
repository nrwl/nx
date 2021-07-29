import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  logger,
  readJson,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

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

export async function nodeMigrateToWebpack5Generator(tree: Tree, schema: {}) {
  let packages = basePackages;
  const tasks: GeneratorCallback[] = [];

  const packageJson = readJson(tree, 'package.json');
  const deps = [
    ...Object.keys(packageJson.dependencies), // just in case someone installed it here
    ...Object.keys(packageJson.devDependencies),
  ];

  if (deps.includes('@nrwl/web')) {
    packages = {
      ...packages,
      ...webPackages,
    };
  }

  logger.info(`NX Adding webpack 5 to workspace.`);

  // Removing the packages ensures that the versions will be updated when adding them after
  tasks.push(
    removeDependenciesFromPackageJson(tree, [], Object.keys(packages))
  );

  tasks.push(addDependenciesToPackageJson(tree, {}, packages));

  return runTasksInSerial(...tasks);
}

export default nodeMigrateToWebpack5Generator;
export const nodeMigrateToWebpack5Schematic = convertNxGenerator(
  nodeMigrateToWebpack5Generator
);
