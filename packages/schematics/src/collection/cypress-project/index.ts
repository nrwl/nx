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
  url
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { join, normalize } from '@angular-devkit/core';
// app
import {
  addDepsToPackageJson,
  getProjectConfig,
  readJsonInTree,
  updateJsonInTree
} from '../../utils/ast-utils';
import { cypressVersion, nxVersion } from '../../lib-versions';
import { offsetFromRoot } from '../../utils/common';
import { Schema } from '../application/schema';

export interface CypressProjectSchema extends Schema {
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
}

function checkArchitectTarget(options: CypressProjectSchema): Rule {
  return (host: Tree): Rule => {
    const projectConfig = getProjectConfig(host, options.e2eProjectName);
    if (!projectConfig.architect.e2e) {
      return updateJsonInTree('angular.json', json => {
        json.projects[options.e2eProjectName] = {};
        return json;
      });
    }

    return noop();
  };
}

function installDependencies(
  dependencyList: { name: string; version: string }[]
): Rule {
  const addedDependencies = dependencyList.reduce((dictionary, value) => {
    dictionary[value.name] = value.version;
    return dictionary;
  }, {});

  return addDepsToPackageJson({}, addedDependencies);
}

function checkDependenciesInstalled(): Rule {
  return (host: Tree): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const dependencyList: { name: string; version: string }[] = [];
    if (!packageJson.devDependencies.cypress) {
      dependencyList.push({ name: 'cypress', version: cypressVersion });
      // NOTE: Need to be removed on the next Cypress release (=>3.1.1)
      dependencyList.push({ name: '@types/jquery', version: '3.3.6' });
    }
    if (!packageJson.devDependencies['@nrwl/builders']) {
      dependencyList.push({ name: '@nrwl/builders', version: nxVersion });
    }

    if (!dependencyList.length) {
      return noop();
    }

    return installDependencies(dependencyList);
  };
}

function generateFiles(options: CypressProjectSchema): Rule {
  return (host: Tree): Rule => {
    host.delete(`${options.e2eProjectRoot}/tsconfig.e2e.json`);
    const projectConfig = getProjectConfig(host, options.e2eProjectName);
    return mergeWith(
      apply(url('./files'), [
        template({
          tmpl: '',
          projectName: options.e2eProjectName,
          relatedProjectName: options.name,
          projectRoot: projectConfig.root,
          offsetFromRoot: offsetFromRoot(projectConfig.root)
        }),
        move(projectConfig.root)
      ])
    );
  };
}

function updateTsConfig(options: CypressProjectSchema): Rule {
  return updateJsonInTree(
    join(normalize(options.e2eProjectRoot), 'tsconfig.json'),
    json => {
      return {
        ...json,
        compilerOptions: {
          ...json.compilerOptions,
          types: [...(json.compilerOptions.types || []), 'cypress', 'node']
        }
      };
    }
  );
}

function updateAngularJson(options: CypressProjectSchema): Rule {
  return updateJsonInTree('angular.json', json => {
    const projectConfig = json.projects[options.e2eProjectName];
    projectConfig.root = options.e2eProjectRoot;

    projectConfig.architect.e2e = {
      builder: '@nrwl/builders:cypress',
      options: {
        cypressConfig: join(normalize(options.e2eProjectRoot), 'cypress.json'),
        tsConfig: join(normalize(options.e2eProjectRoot), 'tsconfig.e2e.json'),
        devServerTarget: `${options.name}:serve`
      },
      configurations: {
        production: {
          devServerTarget: `${options.name}:serve:production`
        }
      }
    };
    projectConfig.architect.lint.options.tsConfig = join(
      normalize(options.e2eProjectRoot),
      'tsconfig.e2e.json'
    );
    json.projects[options.e2eProjectName] = projectConfig;
    return json;
  });
}

export default function(options: CypressProjectSchema): Rule {
  return chain([
    checkArchitectTarget(options),
    checkDependenciesInstalled(),
    updateAngularJson(options),
    updateTsConfig(options),
    generateFiles(options)
  ]);
}
