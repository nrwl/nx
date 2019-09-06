import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  formatFiles,
  updateJsonInTree,
  updateWorkspace
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion,
  reflectMetadataVersion
} from '../../utils/versions';
import { JsonObject } from '@angular-devkit/core';

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

function setDefault(): Rule {
  return updateWorkspace(workspace => {
    workspace.extensions.cli = workspace.extensions.cli || {};

    const defaultCollection: string =
      workspace.extensions.cli &&
      ((workspace.extensions.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.extensions.cli as JsonObject).defaultCollection = '@nrwl/nest';
    }
  });
}

export default function(schema: Schema) {
  return chain([
    setDefault(),
    addPackageWithInit('@nrwl/node'),
    addPackageWithInit('@nrwl/jest'),
    addDependencies(),
    moveDependency(),
    formatFiles(schema)
  ]);
}
