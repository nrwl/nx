import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson, joinPathFragments } from '@nx/devkit';
import {
  nestJsVersion,
  reflectMetadataVersion,
  rxjsVersion,
  tsLibVersion,
} from './versions';

export function ensureDependencies(
  tree: Tree,
  projectRoot?: string
): GeneratorCallback {
  const packageJsonPath = projectRoot
    ? joinPathFragments(projectRoot, 'package.json')
    : 'package.json';

  return addDependenciesToPackageJson(
    tree,
    {
      '@nestjs/common': nestJsVersion,
      '@nestjs/core': nestJsVersion,
      '@nestjs/platform-express': nestJsVersion,
      'reflect-metadata': reflectMetadataVersion,
      rxjs: rxjsVersion,
      tslib: tsLibVersion,
    },
    {
      '@nestjs/testing': nestJsVersion,
    },
    packageJsonPath
  );
}
