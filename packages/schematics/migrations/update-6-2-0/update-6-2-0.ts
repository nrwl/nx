import {
  Rule,
  SchematicContext,
  chain,
  template,
  apply,
  mergeWith,
  url
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { updateJsonInTree } from '../../src/utils/ast-utils';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

function displayInformation(_, context: SchematicContext) {
  context.logger.info(stripIndents`
    A global base karma config has been added at karma.conf.js
    
    This file exports a karma config to be extended in each project

    This new file is not being used yet!

    Generate a new project to see an example of how it might be used.
  `);
}

function setDependencyVersionIfExisting(
  packageNames: string[],
  version: string,
  areDev: boolean
) {
  return updateJsonInTree('package.json', json => {
    const dependencies = areDev ? json.devDependencies : json.dependencies;
    packageNames
      .filter(packageName => !!dependencies[packageName])
      .forEach(packageName => {
        dependencies[packageName] = version;
      });
    return json;
  });
}

function updateDependencies() {
  return chain([
    updateJsonInTree('package.json', json => {
      json.scripts = json.scripts || {};
      json.dependencies = json.dependencies || {};
      json.devDependencies = json.devDependencies || {};

      json.scripts['affected:libs'] = './node_modules/.bin/nx affected:libs';
      if (json.dependencies['@ngrx/store-devtools']) {
        json.devDependencies['@ngrx/store-devtools'] =
          json.dependencies['@ngrx/store-devtools'];
        delete json.dependencies['@ngrx/store-devtools'];
      }
      if (json.dependencies['ngrx-store-freeze']) {
        json.devDependencies['ngrx-store-freeze'] =
          json.dependencies['ngrx-store-freeze'];
        delete json.dependencies['ngrx-store-freeze'];
      }
      delete json.devDependencies['@ngrx/schematics'];
      return json;
    }),
    setDependencyVersionIfExisting(
      [
        '@angular/animations',
        '@angular/common',
        '@angular/compiler',
        '@angular/core',
        '@angular/forms',
        '@angular/http',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
        '@angular/platform-server',
        '@angular/platform-webworker',
        '@angular/platform-webworker-dynamic',
        '@angular/router',
        '@angular/service-worker',
        '@angular/upgrade'
      ],
      '^6.1.0',
      false
    ),
    setDependencyVersionIfExisting(['rxjs'], '6.2.2', false),
    setDependencyVersionIfExisting(
      ['@ngrx/effects', '@ngrx/store', '@ngrx/router-store'],
      '6.0.1',
      false
    ),
    setDependencyVersionIfExisting(['@angular/cli'], '6.1.2', true),
    setDependencyVersionIfExisting(
      ['@angular/compiler-cli', '@angular/language-service'],
      '^6.1.0',
      true
    ),
    setDependencyVersionIfExisting(
      ['@angular-devkit/build-angular'],
      '~0.7.0',
      true
    ),
    setDependencyVersionIfExisting(['ngrx-store-freeze'], '0.2.4', true),
    setDependencyVersionIfExisting(['@ngrx/store-devtools'], '6.0.1', true),
    setDependencyVersionIfExisting(['typescript'], '~2.7.2', true)
  ]);
}

function addGlobalKarmaConf() {
  const templateSource = url('./files');
  return mergeWith(templateSource);
}

const addInstall = (_, context: SchematicContext) => {
  context.addTask(new NodePackageInstallTask());
};

export default function(): Rule {
  return chain([
    displayInformation,
    updateDependencies(),
    addGlobalKarmaConf(),
    addInstall
  ]);
}
