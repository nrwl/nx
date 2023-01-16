import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
} from '@nrwl/devkit';
import { getPkgVersionsForAngularMajorVersion } from '../../utils/version-utils';
import { getInstalledAngularVersionInfo } from '../utils/angular-version-utils';
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

  const installedAngularVersion = getInstalledAngularVersionInfo(tree);
  const { angularVersion: ngPlatformServerVersion, ngUniversalVersion } =
    getPkgVersionsForAngularMajorVersion(installedAngularVersion.major);

  addDependenciesToPackageJson(
    tree,
    {
      '@nguniversal/express-engine': ngUniversalVersion,
      '@angular/platform-server': ngPlatformServerVersion,
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
