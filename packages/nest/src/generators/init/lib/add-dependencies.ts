import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson, readJson } from '@nrwl/devkit';
import { satisfies } from 'semver';
import {
  nestJsSchematicsVersion,
  nestJsVersion7,
  nestJsVersion8,
  nxVersion,
  reflectMetadataVersion,
  rxjsVersion6,
  rxjsVersion7,
} from '../../../utils/versions';

export function addDependencies(tree: Tree): GeneratorCallback {
  // Old nest 7 and rxjs 6 by default
  let NEST_VERSION = nestJsVersion7;
  let RXJS = rxjsVersion6;

  const packageJson = readJson(tree, 'package.json');

  if (packageJson.dependencies['@angular/core']) {
    let rxjs = packageJson.dependencies['rxjs'];

    if (rxjs.startsWith('~') || rxjs.startsWith('^')) {
      rxjs = rxjs.substring(1);
    }

    if (satisfies(rxjs, rxjsVersion7)) {
      NEST_VERSION = nestJsVersion8;
      RXJS = packageJson.dependencies['rxjs'];
    }
  } else {
    NEST_VERSION = nestJsVersion8;
    RXJS = rxjsVersion7;
  }

  return addDependenciesToPackageJson(
    tree,
    {
      '@nestjs/common': NEST_VERSION,
      '@nestjs/core': NEST_VERSION,
      '@nestjs/platform-express': NEST_VERSION,
      'reflect-metadata': reflectMetadataVersion,
      rxjs: RXJS,
      tslib: '^2.0.0',
    },
    {
      '@nestjs/schematics': nestJsSchematicsVersion,
      '@nestjs/testing': NEST_VERSION,
      '@nrwl/nest': nxVersion,
    }
  );
}
