import {
  apply,
  chain,
  mergeWith,
  move,
  noop,
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
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';

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
          ext: options.js ? 'js' : 'ts',
          offsetFromRoot: offsetFromRoot(options.projectRoot)
        }),
        move(options.projectRoot),
        options.js ? toJS() : noop()
      ])
    );
  };
}

function updateNxJson(options: CypressProjectSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.projectName] = {
      tags: [],
      implicitDependencies: [options.project]
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
    addLintFiles(options.projectRoot, options.linter, {
      localConfig: {
        // we need this overrides because we enabled
        // allowJS in the tsconfig to allow for JS based
        // Cypress tests. That however leads to issues
        // with the CommonJS Cypress plugin file
        overrides: [
          {
            files: ['src/plugins/index.js'],
            rules: {
              '@typescript-eslint/no-var-requires': 'off',
              'no-undef': 'off'
            }
          }
        ]
      }
    }),
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
