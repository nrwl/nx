import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson, joinPathFragments } from '@nx/devkit';
import { tsLibVersion, versions } from './versions';

export function ensureDependencies(
  tree: Tree,
  projectRoot?: string
): GeneratorCallback {
  const packageJsonPath = projectRoot
    ? joinPathFragments(projectRoot, 'package.json')
    : 'package.json';

  const pkgVersions = versions(tree);
  return addDependenciesToPackageJson(
    tree,
    {
      '@nestjs/common': pkgVersions.nestJsVersion,
      '@nestjs/core': pkgVersions.nestJsVersion,
      '@nestjs/platform-express': pkgVersions.nestJsVersion,
      'reflect-metadata': pkgVersions.reflectMetadataVersion,
      rxjs: pkgVersions.rxjsVersion,
      tslib: tsLibVersion,
    },
    {
      '@nestjs/testing': pkgVersions.nestJsVersion,
    },
    packageJsonPath,
    true
  );
}
