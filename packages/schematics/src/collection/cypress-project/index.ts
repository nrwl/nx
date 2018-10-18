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
  getProjectConfig,
  readJsonInTree,
  updateJsonInTree
} from '../../utils/ast-utils';
import { cypressVersion, nxVersion } from '../../lib-versions';
import { replaceAppNameWithPath } from '../../utils/cli-config-utils';
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
      throw new Error(
        `${options.e2eProjectName} has no test architect option.`
      );
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
  const updatePackageJson: Rule = updateJsonInTree('package.json', json => {
    return {
      ...json,
      devDependencies: {
        ...json.devDependencies,
        ...addedDependencies
      }
    };
  });

  function doInstall(host: Tree, context: SchematicContext): void {
    context.addTask(new NodePackageInstallTask());
  }

  return chain([updatePackageJson, doInstall]);
}

function checkDependenciesInstalled(): Rule {
  return (host: Tree): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const dependencyList: { name: string; version: string }[] = [];
    if (!packageJson.devDependencies.cypress) {
      dependencyList.push({ name: 'cypress', version: cypressVersion });
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
    const projectConfig = getProjectConfig(host, options.e2eProjectName);
    return mergeWith(
      apply(url('./files'), [
        template({
          tmpl: '',
          projectName: options.e2eProjectName,
          relatedProjectName: options.name,
          offsetFromRoot: offsetFromRoot(projectConfig.root)
        }),
        move(projectConfig.root)
      ])
    );
  };
}

function updateAngularJson(options: CypressProjectSchema): Rule {
  return updateJsonInTree('angular.json', json => {
    const projectConfig = json.projects[options.e2eProjectName];
    const fixedProjectConfig = replaceAppNameWithPath(
      projectConfig,
      options.e2eProjectName,
      options.e2eProjectRoot
    );
    fixedProjectConfig.architect.e2e = {
      builder: '@nrwl/builders:cypress',
      options: {
        cypressConfig: join(normalize(options.e2eProjectRoot), 'cypress.json'),
        tsConfig: join(normalize(options.e2eProjectRoot), 'tsconfig.json'),
        devServerTarget: `${options.name}:serve`
      },
      configurations: {
        production: {
          devServerTarget: `${options.name}:serve:production`
        }
      }
    };
    json.projects[options.e2eProjectName] = fixedProjectConfig;
    return json;
  });
}

export default function(options: CypressProjectSchema): Rule {
  return chain([
    checkArchitectTarget(options),
    checkDependenciesInstalled(),
    updateAngularJson(options),
    generateFiles(options)
  ]);
}
