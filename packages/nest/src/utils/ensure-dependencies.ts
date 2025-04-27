import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson } from '@nx/devkit';
import {
  nestJsVersion,
  reflectMetadataVersion,
  rxjsVersion,
  tsLibVersion,
} from './versions';
import { NormalizedOptions } from '../generators/application/schema';

export function ensureDependencies(
  tree: Tree,
  options: NormalizedOptions
): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {
      '@nestjs/common': nestJsVersion,
      '@nestjs/core': nestJsVersion,
      [`@nestjs/platform-${options.framework}`]: nestJsVersion,
      'reflect-metadata': reflectMetadataVersion,
      rxjs: rxjsVersion,
      tslib: tsLibVersion,
    },
    {
      '@nestjs/testing': nestJsVersion,
    }
  );
}
