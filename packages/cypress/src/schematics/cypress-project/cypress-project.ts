import {
  apply,
  chain,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { join, normalize } from '@angular-devkit/core';
// app
import {
  NxJson,
  Linter,
  addDepsToPackageJson,
  addLintFiles,
  generateProjectLint,
  offsetFromRoot,
  toFileName,
  updateJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { Schema } from './schema';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { eslintPluginCypressVersion } from '../../utils/versions';

export interface CypressProjectSchema extends Schema {
  projectName: string;
  projectRoot: string;
}

function generateFiles(options: CypressProjectSchema): Rule {
  return (): Rule => {
    return mergeWith(
      apply(url('./files'), [
        template({
          tmpl: '',
          ...options,
          ext: options.js ? 'js' : 'ts',
          offsetFromRoot: offsetFromRoot(options.projectRoot),
        }),
        move(options.projectRoot),
        options.js ? toJS() : noop(),
      ])
    );
  };
}

function updateNxJson(options: CypressProjectSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', (json) => {
    json.projects[options.projectName] = {
      tags: [],
    };

    if (options.project) {
      json.projects[options.projectName].implicitDependencies = [
        options.project,
      ];
    }

    return json;
  });
}

function updateWorkspaceJson(options: CypressProjectSchema): Rule {
  return updateWorkspaceInTree((json) => {
    const architect: any = {};

    architect.e2e = {
      builder: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: join(normalize(options.projectRoot), 'cypress.json'),
        tsConfig: join(normalize(options.projectRoot), 'tsconfig.e2e.json'),
        devServerTarget: `${options.project}:serve`,
      },
      configurations: {
        production: {
          devServerTarget: `${options.project}:serve:production`,
        },
      },
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
      architect,
    };
    return json;
  });
}

function addLinter(options: CypressProjectSchema): Rule {
  return chain([
    options.linter === Linter.EsLint
      ? addDepsToPackageJson(
          {},
          { 'eslint-plugin-cypress': eslintPluginCypressVersion }
        )
      : noop(),
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
              'no-undef': 'off',
            },
          },
        ],
        extends: ['plugin:cypress/recommended'],
      },
    }),
  ]);
}

export default function (options: CypressProjectSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    options = normalizeOptions(host, options);
    return chain([
      addLinter(options),
      generateFiles(options),
      updateWorkspaceJson(options),
      updateNxJson(options),
    ])(host, context);
  };
}

function normalizeOptions(
  host: Tree,
  options: CypressProjectSchema
): CypressProjectSchema {
  const projectName = options.directory
    ? toFileName(options.directory) + '-' + options.name
    : options.name;
  const projectRoot = options.directory
    ? join(
        normalize(appsDir(host)),
        toFileName(options.directory),
        options.name
      )
    : join(normalize(appsDir(host)), options.name);
  return {
    ...options,
    projectName,
    projectRoot,
  };
}
