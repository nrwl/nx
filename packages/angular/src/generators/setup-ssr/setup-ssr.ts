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
import {
  angularVersion,
  ngUniversalVersion,
  versions,
} from '../../utils/versions';
import { getInstalledAngularVersionInfo } from '../utils/angular-version-utils';
import { coerce, major } from 'semver';

export async function setupSsr(tree: Tree, schema: Schema) {
  const options = normalizeOptions(tree, schema);

  generateSSRFiles(tree, options);
  updateAppModule(tree, options);
  updateProjectConfig(tree, options);

  const installedAngularVersion = getInstalledAngularVersionInfo(tree);
  const ngUniversalVersionToUse =
    installedAngularVersion.major < major(coerce(angularVersion))
      ? versions[`angularV${installedAngularVersion.major}`]
          ?.ngUniversalVersion ?? ngUniversalVersion
      : ngUniversalVersion;

  const ngPlatformServerVersionToUse =
    installedAngularVersion.major < major(coerce(angularVersion))
      ? versions[`angularV${installedAngularVersion.major}`]?.angularVersion ??
        angularVersion
      : angularVersion;

  addDependenciesToPackageJson(
    tree,
    {
      '@nguniversal/express-engine': ngUniversalVersionToUse,
      '@angular/platform-server': ngPlatformServerVersionToUse,
    },
    {
      '@nguniversal/builders': ngUniversalVersionToUse,
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
