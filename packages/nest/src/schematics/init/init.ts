import { chain, noop, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  formatFiles,
  updateJsonInTree
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion,
  reflectMetadataVersion
} from '../../utils/versions';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

export const updateDependencies = addDepsToPackageJson(
  {
    '@nestjs/common': nestJsVersion,
    '@nestjs/core': nestJsVersion,
    '@nestjs/platform-express': nestJsVersion,
    'reflect-metadata': reflectMetadataVersion
  },
  {
    '@nestjs/schematics': nestJsSchematicsVersion,
    '@nestjs/testing': nestJsVersion,
    '@nrwl/nest': nxVersion
  }
);

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/nest'];
    return json;
  });
}

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/nest'),
    addPackageWithInit('@nrwl/node', schema),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    updateDependencies,
    moveDependency(),
    formatFiles(schema)
  ]);
}
