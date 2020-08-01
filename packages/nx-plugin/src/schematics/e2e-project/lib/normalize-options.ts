import { normalize } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { readNxJsonInTree, toPropertyName } from '@nrwl/workspace';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { join } from 'path';
import { NxPluginE2ESchema, Schema } from '../schema';

function normalizeProjectRoot(
  host: Tree,
  options: Schema,
  projectName: string
) {
  const { projectDirectory } = options;
  if (!projectDirectory) {
    return join(normalize(appsDir(host)), projectName);
  }
  return join(normalize(appsDir(host)), `${projectDirectory}-e2e`);
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NxPluginE2ESchema {
  const projectName = `${options.pluginName}-e2e`;
  const projectRoot = normalizeProjectRoot(host, options, projectName);
  const npmScope = readNxJsonInTree(host).npmScope;
  const pluginPropertyName = toPropertyName(options.pluginName);
  return {
    ...options,
    projectName,
    pluginPropertyName,
    projectRoot,
    npmScope,
  };
}
