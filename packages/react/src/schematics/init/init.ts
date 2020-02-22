import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  updateJsonInTree,
  updateWorkspace
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  nxVersion,
  reactDomVersion,
  reactVersion,
  testingLibraryReactVersion,
  typesReactDomVersion,
  typesReactVersion
} from '../../utils/versions';
import { JsonObject } from '@angular-devkit/core';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

export function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      react: reactVersion,
      'react-dom': reactDomVersion
    },
    {
      '@nrwl/react': nxVersion,
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      '@testing-library/react': testingLibraryReactVersion
    }
  );
}

function moveDependency(): Rule {
  return updateJsonInTree('package.json', json => {
    json.dependencies = json.dependencies || {};

    delete json.dependencies['@nrwl/react'];
    return json;
  });
}

function setDefault(): Rule {
  const updateReactWorkspace = updateWorkspace(workspace => {
    // Also generate all new react apps with babel.
    workspace.extensions.schematics =
      jsonIdentity(workspace.extensions.schematics) || {};
    const reactSchematics =
      jsonIdentity(workspace.extensions.schematics['@nrwl/react']) || {};
    workspace.extensions.schematics = {
      ...workspace.extensions.schematics,
      '@nrwl/react': {
        application: {
          ...jsonIdentity(reactSchematics.application),
          babel: true
        }
      }
    };
  });
  return chain([setDefaultCollection('@nrwl/react'), updateReactWorkspace]);
}

function jsonIdentity(x: any): JsonObject {
  return x as JsonObject;
}

export default function(schema: Schema) {
  return chain([
    setDefault(),
    addPackageWithInit('@nrwl/jest'),
    addPackageWithInit('@nrwl/cypress'),
    addPackageWithInit('@nrwl/web'),
    addDependencies(),
    moveDependency()
  ]);
}
