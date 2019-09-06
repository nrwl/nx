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
  readJsonInTree,
  updateJsonInTree,
  updateWorkspaceInTree
} from '@nrwl/workspace';
import { getProjectConfig, addDepsToPackageJson } from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import init from '../init/init';

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
  return (host: Tree) => {
    const projectConfig = getProjectConfig(host, options.project);
    if (!host.exists(join(projectConfig.root, 'tsconfig.json'))) {
      throw new Error(
        `Expected ${join(
          projectConfig.root,
          'tsconfig.json'
        )} to exist. Please create one.`
      );
    }
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

function updateWorkspaceJson(options: JestProjectSchema): Rule {
  return updateWorkspaceInTree(json => {
    const projectConfig = json.projects[options.project];
    projectConfig.architect.test = {
      builder: '@nrwl/jest:jest',
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
    return host;
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
    init(),
    check(options),
    generateFiles(options),
    updateTsConfig(options),
    updateWorkspaceJson(options)
  ]);
}
