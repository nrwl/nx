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
  filter,
  schematic
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
  supportTsx: boolean;
  skipSetupFile: boolean;
  setupFile: 'angular' | 'web-components' | 'none';
  skipSerializers: boolean;
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
        options.setupFile === 'none'
          ? filter(file => file !== '/src/test-setup.ts')
          : noop(),
        move(projectConfig.root)
      ])
    )(host, context);
  };
}

function updateTsConfig(options: JestProjectSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.project);
    return updateJsonInTree(join(projectConfig.root, 'tsconfig.json'), json => {
      return {
        ...json,
        compilerOptions: {
          ...json.compilerOptions,
          types: Array.from(
            new Set([...(json.compilerOptions.types || []), 'node', 'jest'])
          )
        }
      };
    });
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
    if (options.setupFile !== 'none') {
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

function check(options: JestProjectSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.project);
    if (projectConfig.architect.test) {
      throw new Error(
        `${options.project} already has a test architect option.`
      );
    }
    const packageJson = readJsonInTree(host, 'package.json');
    if (!packageJson.devDependencies.jest) {
      return schematic('jest', {});
    }
  };
}

function normalizeOptions(options: JestProjectSchema): JestProjectSchema {
  if (!options.skipSetupFile) {
    return options;
  }
  return {
    ...options,
    setupFile: 'none'
  };
}

export default function(options: JestProjectSchema): Rule {
  options = normalizeOptions(options);
  return chain([
    check(options),
    generateFiles(options),
    updateTsConfig(options),
    updateAngularJson(options)
  ]);
}
