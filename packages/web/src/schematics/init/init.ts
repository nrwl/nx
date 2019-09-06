import { Rule, chain } from '@angular-devkit/schematics';
import {
  updateJsonInTree,
  addPackageWithInit,
  formatFiles
} from '@nrwl/workspace';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { Schema } from './schema';
import {
  nxVersion,
  documentRegisterElementVersion
} from '../../utils/versions';
import { updateWorkspace } from '@nrwl/workspace';
import { JsonObject } from '@angular-devkit/core';

function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      'document-register-element': documentRegisterElementVersion
    },
    {
      '@nrwl/web': nxVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/web'];
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
      (workspace.extensions.cli as JsonObject).defaultCollection = '@nrwl/web';
    }
  });
}

export default function(schema: Schema) {
  return chain([
    setDefault(),
    addPackageWithInit('@nrwl/jest'),
    addPackageWithInit('@nrwl/cypress'),
    addDependencies(),
    moveDependency(),
    formatFiles(schema)
  ]);
}
