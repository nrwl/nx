import { chain, noop, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  formatFiles,
  setDefaultCollection,
  updateJsonInTree,
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion,
  reflectMetadataVersion,
  rxjsVersion,
} from '../../utils/versions';

export const updateDependencies = addDepsToPackageJson(
  {
    '@nestjs/common': nestJsVersion,
    '@nestjs/core': nestJsVersion,
    '@nestjs/platform-express': nestJsVersion,
    'reflect-metadata': reflectMetadataVersion,
    rxjs: rxjsVersion,
    tslib: '^2.0.0',
  },
  {
    '@nestjs/schematics': nestJsSchematicsVersion,
    '@nestjs/testing': nestJsVersion,
    '@nrwl/nest': nxVersion,
  }
);

function moveDependency(): Rule {
  return updateJsonInTree('package.json', (json) => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/nest'];
    return json;
  });
}

export default function (schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/nest'),
    addPackageWithInit('@nrwl/node', schema),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    updateDependencies,
    moveDependency(),
    formatFiles(schema),
  ]);
}
