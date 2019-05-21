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
  updateJsonInTree
} from '@nrwl/workspace';
import {
  angularVersion,
  angularDevkitVersion,
  rxjsVersion
} from '../../utils/versions';
import { Schema } from './schema';
import { UnitTestRunner, E2eTestRunner } from '../../utils/test-runners';
import { jestPresetAngularVersion } from '../../utils/versions';

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
            'ng-add',
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

function setDefaults(options: Schema): Rule {
  return updateJsonInTree('angular.json', json => {
    json.schematics = json.schematics || {};
    json.schematics['@nrwl/angular:application'] =
      json.schematics['@nrwl/angular:application'] || {};
    json.schematics['@nrwl/angular:application'] = {
      ...json.schematics['@nrwl/angular:application'],
      unitTestRunner: options.unitTestRunner,
      e2eTestRunner: options.e2eTestRunner
    };
    json.schematics['@nrwl/angular:library'] =
      json.schematics['@nrwl/angular:library'] || {};
    json.schematics['@nrwl/angular:library'] = {
      ...json.schematics['@nrwl/angular:library'],
      unitTestRunner: options.unitTestRunner
    };
    return json;
  });
}

export default function(options: Schema): Rule {
  return chain([
    updateDependencies(),
    addUnitTestRunner(options),
    addE2eTestRunner(options),
    setDefaults(options)
  ]);
}
