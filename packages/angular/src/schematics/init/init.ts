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
  setDefaultCollection,
  updateJsonInTree,
  updateWorkspace,
  Linter,
} from '@nrwl/workspace';
import {
  angularDevkitVersion,
  angularVersion,
  jestPresetAngularVersion,
  rxjsVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';

const updateDependencies = (options: Pick<Schema, 'linter'>): Rule =>
  addDepsToPackageJson(
    {
      '@angular/animations': angularVersion,
      '@angular/common': angularVersion,
      '@angular/compiler': angularVersion,
      '@angular/core': angularVersion,
      '@angular/forms': angularVersion,
      '@angular/platform-browser': angularVersion,
      '@angular/platform-browser-dynamic': angularVersion,
      '@angular/router': angularVersion,
      rxjs: rxjsVersion,
      tslib: '^2.0.0',
      'zone.js': '^0.10.2',
    },
    {
      '@angular/compiler-cli': angularVersion,
      '@angular/language-service': angularVersion,
      '@angular-devkit/build-angular': angularDevkitVersion,
      codelyzer: options.linter === Linter.TsLint ? '^6.0.0' : undefined,
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
            protractor: '~7.0.0',
            'jasmine-core': '~3.6.0',
            'jasmine-spec-reporter': '~5.0.0',
            '@types/jasmine': '~3.6.0',
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
    workspace.extensions.schematics['@nrwl/angular:application'] = {
      style: options.style,
      linter: options.linter,
      unitTestRunner: options.unitTestRunner,
      e2eTestRunner: options.e2eTestRunner,
      ...(workspace.extensions.schematics['@nrwl/angular:application'] || {}),
    };
    workspace.extensions.schematics['@nrwl/angular:library'] = {
      style: options.style,
      linter: options.linter,
      unitTestRunner: options.unitTestRunner,
      ...(workspace.extensions.schematics['@nrwl/angular:library'] || {}),
    };
    workspace.extensions.schematics['@nrwl/angular:component'] = {
      style: options.style,
      ...(workspace.extensions.schematics['@nrwl/angular:component'] || {}),
    };
  });

  return chain([setDefaultCollection('@nrwl/angular'), updateAngularWorkspace]);
}

function addPostinstall(): Rule {
  return updateJsonInTree('package.json', (json, context) => {
    json.scripts = json.scripts || {};
    const command = 'ngcc --properties es2015 browser module main';
    if (!json.scripts.postinstall) {
      json.scripts.postinstall = command;
    } else if (!json.scripts.postinstall.includes('ngcc')) {
      json.scripts.postinstall = `${json.scripts.postinstall} && ${command}`;
    }
    return json;
  });
}

export default function (options: Schema): Rule {
  return chain([
    setDefaults(options),
    // TODO: Remove this when ngcc can be run in parallel
    addPostinstall(),
    updateDependencies(options),
    addUnitTestRunner(options),
    addE2eTestRunner(options),
    formatFiles(options),
  ]);
}
