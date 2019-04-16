import { Rule, chain, externalSchematic } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree
} from '@nrwl/schematics/src/utils/ast-utils';
import {
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion
} from '../../utils/versions';

function addDependencies(): Rule {
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
  return chain([externalSchematic('@nrwl/node', 'ng-add', {}), addDependencies(), moveDependency()]);
}
