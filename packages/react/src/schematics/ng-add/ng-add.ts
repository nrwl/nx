import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  updateJsonInTree,
  addPackageWithNgAdd,
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
    workspace.extensions.cli = workspace.extensions.cli || {};

    const defaultCollection: string =
      workspace.extensions.cli &&
      ((workspace.extensions.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.extensions.cli as JsonObject).defaultCollection =
        '@nrwl/react';
    }
  });
}

export default function(schema: Schema) {
  return chain([
    setDefault(),
    addPackageWithNgAdd('@nrwl/jest'),
    addPackageWithNgAdd('@nrwl/cypress'),
    addPackageWithNgAdd('@nrwl/web'),
    addDependencies(),
    moveDependency()
  ]);
}
