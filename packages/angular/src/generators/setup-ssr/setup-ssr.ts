import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import {
  generateSSRFiles,
  normalizeOptions,
  updateAppModule,
  updateProjectConfig,
} from './lib';
import { angularVersion, ngUniversalVersion } from '../../utils/versions';

export async function setupSsr(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);

  generateSSRFiles(tree, options);
  updateAppModule(tree, options);
  updateProjectConfig(tree, options);

  addDependenciesToPackageJson(
    tree,
    {
      '@nguniversal/express-engine': ngUniversalVersion,
      '@angular/platform-server': angularVersion,
    },
    {
      '@nguniversal/builders': ngUniversalVersion,
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
