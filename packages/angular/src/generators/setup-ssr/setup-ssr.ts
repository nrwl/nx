import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  installPackagesTask,
  readProjectConfiguration,
} from '@nx/devkit';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import {
  addDependencies,
  addHydration,
  addServerFile,
  generateSSRFiles,
  generateTsConfigServerJsonForBrowserBuilder,
  normalizeOptions,
  setRouterInitialNavigation,
  setServerTsConfigOptionsForApplicationBuilder,
  updateProjectConfigForApplicationBuilder,
  updateProjectConfigForBrowserBuilder,
  validateOptions,
} from './lib';
import type { Schema } from './schema';

export async function setupSsr(tree: Tree, schema: Schema) {
  validateOptions(tree, schema);
  const options = normalizeOptions(tree, schema);

  const { targets } = readProjectConfiguration(tree, options.project);
  const isUsingApplicationBuilder =
    targets.build.executor === '@angular-devkit/build-angular:application' ||
    targets.build.executor === '@nx/angular:application';

  if (!schema.skipPackageJson) {
    addDependencies(tree, isUsingApplicationBuilder);
  }
  generateSSRFiles(tree, options, isUsingApplicationBuilder);

  if (options.hydration) {
    addHydration(tree, options);
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 17 || !options.hydration) {
    setRouterInitialNavigation(tree, options);
  }

  if (isUsingApplicationBuilder) {
    updateProjectConfigForApplicationBuilder(tree, options);
    setServerTsConfigOptionsForApplicationBuilder(tree, options);
  } else {
    updateProjectConfigForBrowserBuilder(tree, options);
    generateTsConfigServerJsonForBrowserBuilder(tree, options);
  }

  addServerFile(tree, options, isUsingApplicationBuilder);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}

export default setupSsr;
