import {
  Rule,
  Tree,
  mergeWith,
  chain,
  url,
  apply,
  SchematicContext,
  move,
  template,
  noop,
  filter
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  readJsonInTree,
  updateJsonInTree
} from '../../utils/ast-utils';
import { offsetFromRoot } from '../../utils/common';
import { join, normalize } from '@angular-devkit/core';

export interface JestProjectSchema {
  project: string;
  skipSetupFile: boolean;
}

function generateFiles(options: JestProjectSchema): Rule {
  return (host, context) => {
    const projectConfig = getProjectConfig(host, options.project);
    return mergeWith(
      apply(url('./files'), [
        template({
          tmpl: '',
          ...options,
          projectRoot: projectConfig.root,
          offsetFromRoot: offsetFromRoot(projectConfig.root)
        }),
        options.skipSetupFile
          ? filter(file => file !== '/src/test-setup.ts')
          : noop(),
        move(projectConfig.root)
      ])
    )(host, context);
  };
}

function updateAngularJson(options: JestProjectSchema): Rule {
  return updateJsonInTree('angular.json', json => {
    const projectConfig = json.projects[options.project];
    projectConfig.architect.test = {
      builder: '@nrwl/builders:jest',
      options: {
        jestConfig: join(normalize(projectConfig.root), 'jest.config.js'),
        tsConfig: join(normalize(projectConfig.root), 'tsconfig.spec.json')
      }
    };
    if (!options.skipSetupFile) {
      projectConfig.architect.test.options.setupFile = join(
        normalize(projectConfig.root),
        'src/test-setup.ts'
      );
    }
    if (projectConfig.architect.lint) {
      projectConfig.architect.lint.options.tsConfig = [
        ...projectConfig.architect.lint.options.tsConfig,
        join(normalize(projectConfig.root), 'tsconfig.spec.json')
      ];
    }
    return json;
  });
}

function check(options: JestProjectSchema) {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.project);
    if (projectConfig.architect.test) {
      throw new Error(
        `${options.project} already has a test architect option.`
      );
    }
    const packageJson = readJsonInTree(host, 'package.json');
    if (!packageJson.devDependencies.jest) {
      throw new Error(
        `Your workspace does not have jest installed. Please run "ng generate jest" to setup your workspace to run tests with jest.`
      );
    }
  };
}

export default function(options: JestProjectSchema): Rule {
  return chain([
    check(options),
    generateFiles(options),
    updateAngularJson(options)
  ]);
}
