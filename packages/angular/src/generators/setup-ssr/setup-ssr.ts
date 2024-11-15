import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  installPackagesTask,
  readProjectConfiguration,
} from '@nx/devkit';
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
  const options = await normalizeOptions(tree, schema);

  if (!schema.skipPackageJson) {
    addDependencies(tree, options.isUsingApplicationBuilder);
  }
  generateSSRFiles(tree, options);

  if (options.hydration) {
    addHydration(tree, options);
  }

  if (!options.hydration) {
    setRouterInitialNavigation(tree, options);
  }

  if (options.isUsingApplicationBuilder) {
    updateProjectConfigForApplicationBuilder(tree, options);
    setServerTsConfigOptionsForApplicationBuilder(tree, options);
  } else {
    updateProjectConfigForBrowserBuilder(tree, options);
    generateTsConfigServerJsonForBrowserBuilder(tree, options);
  }

  addServerFile(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}

export default setupSsr;
