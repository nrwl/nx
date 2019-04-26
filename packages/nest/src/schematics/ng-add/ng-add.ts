import { Rule, chain } from '@angular-devkit/schematics';
import {
  addPackageWithNgAdd,
  addDepsToPackageJson,
  updateJsonInTree
} from '@nrwl/workspace';
import {
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion
} from '../../utils/versions';

export function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      '@nestjs/common': nestJsVersion,
      '@nestjs/core': nestJsVersion
    },
    {
      '@nestjs/schematics': nestJsSchematicsVersion,
      '@nestjs/testing': nestJsVersion,
      '@nrwl/nest': nxVersion
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
