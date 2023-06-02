import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
} from '@nx/devkit';
import { versions } from '../utils/version-utils';
import {
  generateSSRFiles,
  normalizeOptions,
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

  const pkgVersions = versions(tree);

  addDependenciesToPackageJson(
    tree,
    {
      '@nguniversal/express-engine': pkgVersions.ngUniversalVersion,
      '@angular/platform-server': pkgVersions.angularVersion,
    },
    {
      '@nguniversal/builders': pkgVersions.ngUniversalVersion,
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
