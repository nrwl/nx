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
  url,
  externalSchematic
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
  offsetFromRoot,
  readNxJson
} from '@nrwl/workspace';
import { WorkspaceDefinition } from '@angular-devkit/core/src/workspace';
import { Chain } from '@angular/compiler';

export interface NxPluginE2ESchema extends Schema {
  projectRoot: string;
  projectName: string;
  npmScope: string;
}

export default function(options: Schema): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const workspace = await getWorkspace(host);
    validatePlugin(workspace, options.pluginName);
    const normalizedOptions = await normalizeOptions(workspace, options);
    return chain([
      updateFiles(normalizedOptions),
      updateNxJson(normalizedOptions),
      updateWorkspaceJson(normalizedOptions),
      addJest(normalizedOptions)
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
  const npmScope = readNxJson().npmScope;
  return {
    ...options,
    projectName,
    projectRoot,
    npmScope
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

function updateWorkspaceJson(options: NxPluginE2ESchema): Rule {
  return chain([
    async (host, context) => {
      const workspace = await getWorkspace(host);
      workspace.projects.add({
        name: options.projectName,
        root: options.projectRoot,
        projectType: 'application',
        sourceRoot: `${options.projectRoot}/src`,
        targets: {
          e2e: {
            builder: '@nrwl/nx-plugin:e2e',
            options: {
              target: `${options.pluginName}:build`,
              npmPackageName: options.npmPackageName,
              pluginOutputPath: options.pluginOutputPath
            }
          }
        }
      });
      return updateWorkspace(workspace);
    }
  ]);
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

function addJest(options: NxPluginE2ESchema): Rule {
  return chain([
    externalSchematic('@nrwl/jest', 'jest-project', {
      project: options.projectName,
      setupFile: 'none',
      supportTsx: false,
      skipSerializers: true
    }),
    async (host, context) => {
      const workspace = await getWorkspace(host);
      const project = workspace.projects.get(options.projectName);
      const testOptions = project.targets.get('test').options;
      const e2eOptions = project.targets.get('e2e').options;
      project.targets.get('e2e').options = {
        ...e2eOptions,
        ...{
          jestConfig: testOptions.jestConfig,
          tsSpecConfig: testOptions.tsConfig
        }
      };

      // remove the jest build target
      project.targets.delete('test');

      return updateWorkspace(workspace);
    }
  ]);
}
