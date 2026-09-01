import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  installPackagesTask,
  readProjectConfiguration,
} from '@nx/devkit';
import { assertSupportedAngularVersion } from '../../utils/assert-supported-angular-version';
import {
  addDependencies,
  addHydration,
  addServerFile,
  generateSSRFiles,
  generateTsConfigServerJsonForBrowserBuilder,
  normalizeOptions,
  setRouterInitialNavigation,
  setServerTsConfigOptionsForSingleProgramBuild,
  updateProjectConfigForApplicationBuilder,
  updateProjectConfigForBrowserBuilder,
  validateOptions,
} from './lib';
import type { Schema } from './schema';

export async function setupSsr(tree: Tree, schema: Schema) {
  assertSupportedAngularVersion(tree);
  validateOptions(tree, schema);
  const options = await normalizeOptions(tree, schema);

  if (!schema.skipPackageJson) {
    addDependencies(tree, options);
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
  } else {
    updateProjectConfigForBrowserBuilder(tree, options);
  }

  // rspack compiles the browser and the server bundles from the build tsconfig,
  // so the separate tsconfig.server.json the server builder needs is dead weight
  if (options.isUsingApplicationBuilder || options.isRspack) {
    setServerTsConfigOptionsForSingleProgramBuild(tree, options);
  } else {
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
