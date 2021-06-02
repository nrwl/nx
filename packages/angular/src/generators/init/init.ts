import { cypressInitGenerator } from '@nrwl/cypress';
import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  readWorkspaceConfiguration,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  angularVersion,
  jestPresetAngularVersion,
  rxjsVersion,
} from '../../utils/versions';
import { karmaGenerator } from '../karma/karma';
import { Schema } from './schema';

export default async function (host: Tree, options: Schema) {
  setDefaults(host, options);
  addPostInstall(host);
  updateDependencies(host);

  addUnitTestRunner(host, options);

  addE2ETestRunner(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

function setDefaults(host: Tree, options: Schema) {
  const workspace = readWorkspaceConfiguration(host);

  workspace.generators = workspace.generators || {};
  workspace.generators['@nrwl/angular:application'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    ...(workspace.generators['@nrwl/angular:application'] || {}),
  };
  workspace.generators['@nrwl/angular:library'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    ...(workspace.generators['@nrwl/angular:library'] || {}),
  };
  workspace.generators['@nrwl/angular:component'] = {
    style: options.style,
    ...(workspace.generators['@nrwl/angular:component'] || {}),
  };

  updateWorkspaceConfiguration(host, workspace);
  setDefaultCollection(host, '@nrwl/angular');
}

function addPostInstall(host: Tree) {
  updateJson(host, 'package.json', (pkgJson) => {
    pkgJson.scripts = pkgJson.scripts ?? {};
    const command = 'ngcc --properties es2015 browser module main';
    if (!pkgJson.scripts.postinstall) {
      pkgJson.scripts.postinstall = command;
    } else if (!pkgJson.scripts.postinstall.includes('ngcc')) {
      pkgJson.scripts.postinstall = `${pkgJson.scripts.postinstall} && ${command}`;
    }
    return pkgJson;
  });
}

function updateDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
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
      'zone.js': '~0.11.4',
    },
    {
      '@angular/compiler-cli': angularVersion,
      '@angular/language-service': angularVersion,
      '@angular-devkit/build-angular': angularVersion,
    }
  );
}

function addUnitTestRunner(
  host: Tree,
  options: Pick<Schema, 'unitTestRunner'>
) {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Karma:
      karmaGenerator(host);
    case UnitTestRunner.Jest:
      addDependenciesToPackageJson(
        host,
        {},
        {
          'jest-preset-angular': jestPresetAngularVersion,
        }
      );

      const pkgJson = readJson(host, 'package.json');
      if (!pkgJson.devDependencies['@nrwl/jest']) {
        jestInitGenerator(host, {});
      }
    default:
      return;
  }
}

function addE2ETestRunner(host: Tree, options: Pick<Schema, 'e2eTestRunner'>) {
  const pkgJson = readJson(host, 'package.json');
  switch (options.e2eTestRunner) {
    case E2eTestRunner.Protractor:
      if (!pkgJson.devDependencies['protractor']) {
        addDependenciesToPackageJson(
          host,
          {},
          {
            protractor: '~7.0.0',
            'jasmine-core': '~3.6.0',
            'jasmine-spec-reporter': '~5.0.0',
            '@types/jasmine': '~3.6.0',
            '@types/jasminewd2': '~2.0.3',
          }
        );
      }
    case E2eTestRunner.Cypress:
      if (!pkgJson.devDependencies['@nrwl/cypress']) {
        cypressInitGenerator(host);
      }
    default:
      return;
  }
}
