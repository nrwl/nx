import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithNgAdd,
  updateJsonInTree
} from '@nrwl/workspace';
import {
  expressTypingsVersion,
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion,
  reflectMetadataVersion
} from '../../utils/versions';

export function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      '@nestjs/common': nestJsVersion,
      '@nestjs/core': nestJsVersion,
      '@nestjs/platform-express': nestJsVersion,
      'reflect-metadata': reflectMetadataVersion
    },
    {
      '@nestjs/schematics': nestJsSchematicsVersion,
      '@nestjs/testing': nestJsVersion,
      '@nrwl/nest': nxVersion,
      '@types/express': expressTypingsVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/nest'];
    return json;
  });
}

export default function() {
  return chain([
    addPackageWithNgAdd('@nrwl/node'),
    addPackageWithNgAdd('@nrwl/jest'),
    addDependencies(),
    moveDependency()
  ]);
}
