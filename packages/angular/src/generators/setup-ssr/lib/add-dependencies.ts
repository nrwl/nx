import { addDependenciesToPackageJson, type Tree } from '@nx/devkit';
import {
  getInstalledAngularVersionInfo,
  getInstalledPackageVersionInfo,
  versions,
} from '../../utils/version-utils';

export function addDependencies(tree: Tree): void {
  const pkgVersions = versions(tree);
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  const dependencies: Record<string, string> = {
    '@angular/platform-server':
      getInstalledPackageVersionInfo(tree, '@angular/platform-server')
        ?.version ?? pkgVersions.angularVersion,
    express: pkgVersions.expressVersion,
  };
  const devDependencies: Record<string, string> = {
    '@types/express': pkgVersions.typesExpressVersion,
  };

  if (angularMajorVersion >= 17) {
    dependencies['@angular/ssr'] =
      getInstalledPackageVersionInfo(tree, '@angular-devkit/build-angular')
        ?.version ?? pkgVersions.angularDevkitVersion;
  } else {
    dependencies['@nguniversal/express-engine'] =
      getInstalledPackageVersionInfo(tree, '@nguniversal/express-engine')
        ?.version ?? pkgVersions.ngUniversalVersion;
    devDependencies['@nguniversal/builders'] =
      getInstalledPackageVersionInfo(tree, '@nguniversal/builders')?.version ??
      pkgVersions.ngUniversalVersion;
  }

  addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
