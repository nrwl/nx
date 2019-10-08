import {
    chain,
    noop,
    Rule,
    Tree,
    SchematicContext
  } from '@angular-devkit/schematics';
  import {
    addDepsToPackageJson,
    readJsonInTree,
    updateJsonInTree
  } from '@nrwl/workspace';
  import {
    strykerMutatorApi, strykerMutatorCore, strykerMutatorHtmlReporter, strykerMutatorJestRunner, strykerMutatorTypescript, strykerMutatorKarmaRunner
  } from '../../../utils/versions';
  import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
  
  function checkDependenciesInstalled(): Rule {
    return (host: Tree, context: SchematicContext): Rule => {
      const packageJson = readJsonInTree(host, 'package.json');
      const dependencyList: { name: string; version: string }[] = [];
      if (!packageJson.devDependencies['@nrwl/stryker']) {
        context.addTask(new NodePackageInstallTask());
        dependencyList.push(
          { name: '@nrwl/stryker', version: '*' },
          { name: '@stryker-mutator/api', version: strykerMutatorApi },
          { name: '@stryker-mutator/core', version: strykerMutatorCore },
          {
            name: '@stryker-mutator/html-reporter',
            version: strykerMutatorHtmlReporter
          },
          { name: '@stryker-mutator/jest-runner', version: strykerMutatorJestRunner },
          { name: '@stryker-mutator/typescript', version: strykerMutatorTypescript },
          { name: '@stryker-mutator/karma-runner', version: strykerMutatorKarmaRunner },
        );
      }
  
      if (!dependencyList.length) {
        return noop();
      }
  
      return addDepsToPackageJson(
        {},
        dependencyList.reduce((dictionary, value) => {
          dictionary[value.name] = value.version;
          return dictionary;
        }, {})
      );
    };
  }
  
  function removeDependency() {
    return updateJsonInTree('package.json', json => {
      json.dependencies = json.dependencies || {};
      delete json.dependencies['@nrwl/stryker'];
      delete json.dependencies['@stryker-mutator/api'];
      delete json.dependencies['@stryker-mutator/core'];
      delete json.dependencies['@stryker-mutator/jest-runner'];
      delete json.dependencies['@stryker-mutator/typescript'];
      delete json.dependencies['@stryker-mutator/karma-runner'];
      return json;
    });
  }
  
  export default function(schema: any) {
    return chain([removeDependency(), checkDependenciesInstalled()]);
  }