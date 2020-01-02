import {
  Rule,
  Tree,
  SchematicContext,
  chain,
  SchematicsException,
  mergeWith,
  apply,
  template,
  move,
  url
} from '@angular-devkit/schematics';

import { Schema } from './schema';
import { join } from 'path';
import { normalize } from '@angular-devkit/core';
import {
  getWorkspace,
  updateJsonInTree,
  NxJson,
  updateWorkspaceInTree,
  updateWorkspace,
  offsetFromRoot
} from '@nrwl/workspace';
import { WorkspaceDefinition } from '@angular-devkit/core/src/workspace';

export interface NxPluginE2ESchema extends Schema {
  projectRoot: string;
  projectName: string;
}

export default function(options: Schema): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host);
    validatePlugin(workspace, options.pluginName);
    const normalizedOptions = await normalizeOptions(workspace, options);
    return chain([
      updateNxJson(normalizedOptions),
      updateWorkspaceJson(workspace, normalizedOptions),
      updateFiles(normalizedOptions)
    ]);
  };
}

function validatePlugin(workspace: WorkspaceDefinition, pluginName: string) {
  const project = workspace.projects.get(pluginName);
  if (!project) {
    throw new SchematicsException(
      `Project name "${pluginName}" doesn't not exist.`
    );
  }
}

function normalizeOptions(
  workspace: WorkspaceDefinition,
  options: Schema
): NxPluginE2ESchema {
  const projectName = `${options.pluginName}-e2e`;
  const projectRoot = join(normalize('apps'), projectName);
  return {
    ...options,
    projectName,
    projectRoot
  };
}

function updateNxJson(options: NxPluginE2ESchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.projectName] = {
      tags: []
    };
    return json;
  });
}

function updateWorkspaceJson(
  workspace: WorkspaceDefinition,
  options: NxPluginE2ESchema
): Rule {
  workspace.projects.add({
    name: options.projectName,
    root: options.projectRoot,
    projectType: 'application',
    sourceRoot: `${options.projectRoot}/src`,
    targets: {
      e2e: {
        builder: '@nrwl/nx-plugin:e2e',
        options: {
          target: `${options.pluginName}:build`
        }
      }
    }
  });
  return updateWorkspace(workspace);
}

function updateFiles(options: NxPluginE2ESchema): Rule {
  return mergeWith(
    apply(url('./files'), [
      template({
        tmpl: '',
        ...options,
        offsetFromRoot: offsetFromRoot(options.projectRoot)
      }),
      move(options.projectRoot)
    ])
  );
}
