import { chain, noop, Rule } from '@angular-devkit/schematics';
import { JsonObject } from '@angular-devkit/core';
import {
  addPackageWithInit,
  setDefaultCollection,
  updateWorkspace,
  addDepsToPackageJson,
} from '@nrwl/workspace';
import { Schema } from './schema';
import {
  nxVersion,
  reactDomVersion,
  reactVersion,
  testingLibraryReactVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';

function setDefault(): Rule {
  const updateReactWorkspace = updateWorkspace((workspace) => {
    // Also generate all new react apps with babel.
    workspace.extensions.schematics =
      jsonIdentity(workspace.extensions.schematics) || {};
    const reactSchematics =
      jsonIdentity(workspace.extensions.schematics['@nrwl/react']) || {};

    workspace.extensions.schematics = {
      ...workspace.extensions.schematics,
      '@nrwl/react': {
        ...reactSchematics,
        application: {
          ...jsonIdentity(reactSchematics.application),
          babel: true,
        },
      },
    };
  });
  return chain([setDefaultCollection('@nrwl/react'), updateReactWorkspace]);
}

function jsonIdentity(x: any): JsonObject {
  return x as JsonObject;
}

export default function (schema: Schema) {
  return chain([
    setDefault(),
    schema.unitTestRunner === 'jest'
      ? addPackageWithInit('@nrwl/jest')
      : noop(),
    schema.e2eTestRunner === 'cypress'
      ? addPackageWithInit('@nrwl/cypress')
      : noop(),
    addPackageWithInit('@nrwl/web', schema),
    addDepsToPackageJson(
      {
        react: reactVersion,
        'react-dom': reactDomVersion,
      },
      {
        '@nrwl/react': nxVersion,
        '@types/react': typesReactVersion,
        '@types/react-dom': typesReactDomVersion,
        '@testing-library/react': testingLibraryReactVersion,
      }
    ),
  ]);
}
