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
} from './lib';
import type { Schema } from './schema';

export async function setupSsr(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);

  generateSSRFiles(tree, options);
  updateAppModule(tree, options);
  updateProjectConfig(tree, options);

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
