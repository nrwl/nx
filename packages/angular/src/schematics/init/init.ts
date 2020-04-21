import {
  chain,
  externalSchematic,
  noop,
  Rule,
  schematic,
  Tree,
} from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  formatFiles,
  readJsonInTree,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import {
  angularDevkitVersion,
  angularVersion,
  jestPresetAngularVersion,
  rxjsVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';

const updateDependencies = addDepsToPackageJson(
  {
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
    'zone.js': '^0.10.2',
  },
  {
    '@angular/compiler-cli': angularVersion,
    '@angular/language-service': angularVersion,
    '@angular-devkit/build-angular': angularDevkitVersion,
    codelyzer: '~5.0.1',
  }
);

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
            'jest-preset-angular': jestPresetAngularVersion,
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
              interactive: false,
            }
          );
        },
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
            '@types/jasminewd2': '~2.0.3',
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
            interactive: false,
          }
        );
      };
    default:
      return noop();
  }
}

export function setDefaults(options: Schema): Rule {
  const updateAngularWorkspace = updateWorkspace((workspace) => {
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
  });

  return chain([setDefaultCollection('@nrwl/angular'), updateAngularWorkspace]);
}

function addPostinstall(): Rule {
  return updateJsonInTree('package.json', (json, context) => {
    json.scripts = json.scripts || {};

    if (!json.scripts.postinstall) {
      json.scripts.postinstall =
        'ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points';
    } else if (!json.scripts.postinstall.includes('ngcc')) {
      context.logger.warn(
        stripIndents`
            ---------------------------------------------------------------------------------------
            Angular Ivy requires you to run ngcc after every npm install.
            The easiest way to accomplish this is to update your postinstall script to invoke ngcc.
            ---------------------------------------------------------------------------------------
          `
      );
    }
    return json;
  });
}

export default function (options: Schema): Rule {
  return chain([
    setDefaults(options),
    // TODO: Remove this when ngcc can be run in parallel
    addPostinstall(),
    updateDependencies,
    addUnitTestRunner(options),
    addE2eTestRunner(options),
    formatFiles(),
  ]);
}
