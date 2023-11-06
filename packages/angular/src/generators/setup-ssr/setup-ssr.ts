import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
} from '@nx/devkit';
import {
  getInstalledAngularVersionInfo,
  getInstalledPackageVersionInfo,
  versions,
} from '../utils/version-utils';
import {
  addHydration,
  generateSSRFiles,
  normalizeOptions,
  setRouterInitialNavigation,
  updateAppModule,
  updateProjectConfig,
  validateOptions,
} from './lib';
import type { Schema } from './schema';

export async function setupSsr(tree: Tree, schema: Schema) {
  validateOptions(tree, schema);
  const options = normalizeOptions(tree, schema);

  updateProjectConfig(tree, options);
  generateSSRFiles(tree, options);

  if (!options.standalone) {
    updateAppModule(tree, options);
  }

  if (options.hydration) {
    addHydration(tree, options);
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  if (angularMajorVersion < 17 || !options.hydration) {
    setRouterInitialNavigation(tree, options);
  }

  const pkgVersions = versions(tree);

  addDependenciesToPackageJson(
    tree,
    {
      '@nguniversal/express-engine':
        getInstalledPackageVersionInfo(tree, '@nguniversal/express-engine')
          ?.version ?? pkgVersions.ngUniversalVersion,
      '@angular/platform-server':
        getInstalledPackageVersionInfo(tree, '@angular/platform-server')
          ?.version ?? pkgVersions.angularVersion,
    },
    {
      '@nguniversal/builders':
        getInstalledPackageVersionInfo(tree, '@nguniversal/builders')
          ?.version ?? pkgVersions.ngUniversalVersion,
    }
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}

export default setupSsr;
