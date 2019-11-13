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
  babelCoreVersion,
  babelLoaderVersion,
  storybookVersion
} from '../../utils/versions';
import { Schema } from './schema';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

function checkDependenciesInstalled(): Rule {
  return (host: Tree, context: SchematicContext): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const dependencyList: { name: string; version: string }[] = [];
    if (!packageJson.devDependencies['@storybook/angular']) {
      context.addTask(new NodePackageInstallTask());
      dependencyList.push(
        { name: '@nrwl/storybook', version: '*' },
        { name: '@storybook/angular', version: storybookVersion },
        { name: '@storybook/react', version: storybookVersion },
        { name: '@storybook/addon-knobs', version: storybookVersion },
        { name: 'babel-loader', version: babelLoaderVersion },
        { name: '@babel/core', version: babelCoreVersion },
        { name: 'to-string-loader', version: '*' },
        { name: 'html-loader', version: '*' },
        { name: 'css-loader', version: '*' }
      );
    }
    if (
      !packageJson.dependencies['@angular/forms'] &&
      !packageJson.devDependencies['@angular/forms']
    ) {
      dependencyList.push({
        name: '@angular/forms',
        version: '*'
      });
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
    delete json.dependencies['@nrwl/storybook'];
    return json;
  });
}

export default function(schema: Schema) {
  return chain([removeDependency(), checkDependenciesInstalled()]);
}
