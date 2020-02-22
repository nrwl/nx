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
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

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

export default function(schema: Schema) {
  return chain([
    setDefaultCollection('@nrwl/web'),
    addPackageWithInit('@nrwl/jest'),
    addPackageWithInit('@nrwl/cypress'),
    addDependencies(),
    moveDependency(),
    formatFiles(schema)
  ]);
}
