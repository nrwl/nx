import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree,
  addPackageWithInit,
  updateWorkspace
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  frameworkVersion,
  typesVersion,
  domTypesVersion,
  testingLibraryVersion,
  nxVersion
} from '../../utils/versions';
import { JsonObject } from '@angular-devkit/core';

export function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      react: frameworkVersion,
      'react-dom': frameworkVersion
    },
    {
      '@nrwl/react': nxVersion,
      '@types/react': typesVersion,
      '@types/react-dom': domTypesVersion,
      '@testing-library/react': testingLibraryVersion
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
  return updateWorkspace(workspace => {
    // Set workspace default collection to 'react' if not already set.
    workspace.extensions.cli = workspace.extensions.cli || {};
    const defaultCollection: string =
      workspace.extensions.cli &&
      ((workspace.extensions.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.extensions.cli as JsonObject).defaultCollection =
        '@nrwl/react';
    }

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
