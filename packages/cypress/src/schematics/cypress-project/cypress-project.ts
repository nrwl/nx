import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  template,
  url
} from '@angular-devkit/schematics';
import { join, normalize } from '@angular-devkit/core';
// app
import {
  updateJsonInTree,
  NxJson,
  updateWorkspaceInTree,
  generateProjectLint,
  addLintFiles
} from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';
import { toFileName } from '@nrwl/workspace';
import { Schema } from './schema';

export interface CypressProjectSchema extends Schema {
  projectName: string;
  projectRoot: string;
}

function generateFiles(options: CypressProjectSchema): Rule {
  return (): Rule => {
    // host.delete(`${options.projectRoot}/tsconfig.e2e.json`);
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
  };
}

function updateNxJson(options: CypressProjectSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.projectName] = {
      tags: []
    };
    return json;
  });
}

function updateWorkspaceJson(options: CypressProjectSchema): Rule {
  return updateWorkspaceInTree(json => {
    const architect: any = {};

    architect.e2e = {
      builder: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: join(normalize(options.projectRoot), 'cypress.json'),
        tsConfig: join(normalize(options.projectRoot), 'tsconfig.e2e.json'),
        devServerTarget: `${options.project}:serve`
      },
      configurations: {
        production: {
          devServerTarget: `${options.project}:serve:production`
        }
      }
    };

    architect.lint = generateProjectLint(
      normalize(options.projectRoot),
      join(normalize(options.projectRoot), 'tsconfig.e2e.json'),
      options.linter
    );

    json.projects[options.projectName] = {
      root: options.projectRoot,
      sourceRoot: join(normalize(options.projectRoot), 'src'),
      projectType: 'application',
      architect
    };
    return json;
  });
}

export default function(options: CypressProjectSchema): Rule {
  options = normalizeOptions(options);
  return chain([
    addLintFiles(options.projectRoot, options.linter),
    generateFiles(options),
    updateWorkspaceJson(options),
    updateNxJson(options)
  ]);
}

function normalizeOptions(options: CypressProjectSchema): CypressProjectSchema {
  const projectName = options.directory
    ? toFileName(options.directory) + '-' + options.name
    : options.name;
  const projectRoot = options.directory
    ? join(normalize('apps'), toFileName(options.directory), options.name)
    : join(normalize('apps'), options.name);
  return {
    ...options,
    projectName,
    projectRoot
  };
}
