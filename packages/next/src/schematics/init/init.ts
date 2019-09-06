import { JsonObject } from '@angular-devkit/core';
import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  updateWorkspace
} from '@nrwl/workspace';
import { frameworkVersion, pluginVersion } from '../../utils/versions';
import { Schema } from './schema';

export function addDependencies(): Rule {
  return addDepsToPackageJson(
    {
      next: frameworkVersion,
      '@zeit/next-css': pluginVersion,
      '@zeit/next-sass': pluginVersion,
      '@zeit/next-less': pluginVersion,
      '@zeit/next-stylus': pluginVersion
    },
    {}
  );
}

function setDefault(): Rule {
  return updateWorkspace(workspace => {
    // Set workspace default collection to 'react' if not already set.
    workspace.extensions.cli = workspace.extensions.cli || {};
    const defaultCollection: string =
      workspace.extensions.cli &&
      ((workspace.extensions.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.extensions.cli as JsonObject).defaultCollection = '@nrwl/next';
    }
  });
}

export default function(schema: Schema) {
  return chain([
    setDefault(),
    addPackageWithInit('@nrwl/jest'),
    addPackageWithInit('@nrwl/cypress'),
    addPackageWithInit('@nrwl/web'),
    addPackageWithInit('@nrwl/react'),
    addDependencies()
  ]);
}
