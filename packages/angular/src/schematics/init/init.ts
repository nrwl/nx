import {
  chain,
  Rule,
  Tree,
  noop,
  externalSchematic,
  schematic
} from '@angular-devkit/schematics';
import {
  readJsonInTree,
  addDepsToPackageJson,
  updateWorkspace,
  formatFiles
} from '@nrwl/workspace';
import {
  angularVersion,
  angularDevkitVersion,
  rxjsVersion
} from '../../utils/versions';
import { Schema } from './schema';
import { UnitTestRunner, E2eTestRunner } from '../../utils/test-runners';
import { jestPresetAngularVersion } from '../../utils/versions';
import { JsonObject } from '@angular-devkit/core';

function updateDependencies(): Rule {
  const deps = {
    '@angular/animations': angularVersion,
    '@angular/common': angularVersion,
    '@angular/compiler': angularVersion,
    '@angular/core': angularVersion,
    '@angular/forms': angularVersion,
    '@angular/platform-browser': angularVersion,
    '@angular/platform-browser-dynamic': angularVersion,
    '@angular/router': angularVersion,
    'core-js': '^2.5.4',
    rxjs: rxjsVersion,
    'zone.js': '^0.9.1'
  };
  const devDeps = {
    '@angular/compiler-cli': angularVersion,
    '@angular/language-service': angularVersion,
    '@angular-devkit/build-angular': angularDevkitVersion,
    codelyzer: '~5.0.1'
  };

  return addDepsToPackageJson(deps, devDeps);
}

export function addUnitTestRunner(
  options: Pick<Schema, 'unitTestRunner'>
): Rule {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Karma:
      return schematic('karma', {});
    case UnitTestRunner.Jest:
      return chain([
        addDepsToPackageJson(
          {},
          {
            'jest-preset-angular': jestPresetAngularVersion
          }
        ),
        (host: Tree) => {
          const packageJson = readJsonInTree(host, 'package.json');
          if (packageJson.devDependencies['@nrwl/jest']) {
            return noop();
          }
          return externalSchematic(
            '@nrwl/jest',
            'init',
            {},
            {
              interactive: false
            }
          );
        }
      ]);
    default:
      return noop();
  }
}

export function addE2eTestRunner(options: Pick<Schema, 'e2eTestRunner'>): Rule {
  switch (options.e2eTestRunner) {
    case E2eTestRunner.Protractor:
      return (host: Tree) => {
        const packageJson = readJsonInTree(host, 'package.json');
        if (packageJson.devDependencies['protractor']) {
          return noop();
        }
        return addDepsToPackageJson(
          {},
          {
            protractor: '~5.4.0',
            'jasmine-core': '~2.99.1',
            'jasmine-spec-reporter': '~4.2.1',
            '@types/jasmine': '~2.8.6',
            '@types/jasminewd2': '~2.0.3'
          }
        );
      };
    case E2eTestRunner.Cypress:
      return (host: Tree) => {
        const packageJson = readJsonInTree(host, 'package.json');
        if (packageJson.devDependencies['@nrwl/cypress']) {
          return noop();
        }
        return externalSchematic(
          '@nrwl/cypress',
          'ng-add',
          {},
          {
            interactive: false
          }
        );
      };
    default:
      return noop();
  }
}

export function setDefaults(options: Schema): Rule {
  return updateWorkspace(workspace => {
    workspace.extensions.schematics = workspace.extensions.schematics || {};

    workspace.extensions.schematics['@nrwl/angular:application'] =
      workspace.extensions.schematics['@nrwl/angular:application'] || {};
    workspace.extensions.schematics[
      '@nrwl/angular:application'
    ].unitTestRunner =
      workspace.extensions.schematics['@nrwl/angular:application']
        .unitTestRunner || options.unitTestRunner;
    workspace.extensions.schematics['@nrwl/angular:application'].e2eTestRunner =
      workspace.extensions.schematics['@nrwl/angular:application']
        .e2eTestRunner || options.e2eTestRunner;

    workspace.extensions.schematics['@nrwl/angular:library'] =
      workspace.extensions.schematics['@nrwl/angular:library'] || {};
    workspace.extensions.schematics['@nrwl/angular:library'].unitTestRunner =
      workspace.extensions.schematics['@nrwl/angular:library'].unitTestRunner ||
      options.unitTestRunner;

    workspace.extensions.cli = workspace.extensions.cli || {};
    const defaultCollection: string =
      workspace.extensions.cli &&
      ((workspace.extensions.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.extensions.cli as JsonObject).defaultCollection =
        '@nrwl/angular';
    }
  });
}

export default function(options: Schema): Rule {
  return chain([
    setDefaults(options),
    updateDependencies(),
    addUnitTestRunner(options),
    addE2eTestRunner(options),
    formatFiles()
  ]);
}
