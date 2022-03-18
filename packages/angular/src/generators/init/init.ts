import { cypressInitGenerator } from '@nrwl/cypress';
import { GeneratorCallback, logger, Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  readWorkspaceConfiguration,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  angularVersion,
  angularDevkitVersion,
  jestPresetAngularVersion,
  rxjsVersion,
} from '../../utils/versions';
import { karmaGenerator } from '../karma/karma';
import { Schema } from './schema';

export async function angularInitGenerator(
  host: Tree,
  rawOptions: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  setDefaults(host, options);
  addPostInstall(host);

  const depsTask = !options.skipPackageJson
    ? updateDependencies(host)
    : () => {};
  const unitTestTask = addUnitTestRunner(host, options);
  const e2eTask = addE2ETestRunner(host, options);
  addGitIgnoreEntry(host, '.angular');

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(depsTask, unitTestTask, e2eTask);
}

function normalizeOptions(options: Schema): Required<Schema> {
  return {
    e2eTestRunner: options.e2eTestRunner ?? E2eTestRunner.Cypress,
    linter: options.linter ?? Linter.EsLint,
    skipFormat: options.skipFormat ?? false,
    skipInstall: options.skipInstall ?? false,
    skipPackageJson: options.skipPackageJson ?? false,
    style: options.style ?? 'css',
    unitTestRunner: options.unitTestRunner ?? UnitTestRunner.Jest,
  };
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

function updateDependencies(host: Tree): GeneratorCallback {
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
      '@angular/cli': angularDevkitVersion,
      '@angular/compiler-cli': angularVersion,
      '@angular/language-service': angularVersion,
      '@angular-devkit/build-angular': angularDevkitVersion,
    }
  );
}

function addUnitTestRunner(host: Tree, options: Schema): GeneratorCallback {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Karma:
      return karmaGenerator(host, { skipPackageJson: options.skipPackageJson });
    case UnitTestRunner.Jest:
      if (!options.skipPackageJson) {
        addDependenciesToPackageJson(
          host,
          {},
          {
            'jest-preset-angular': jestPresetAngularVersion,
          }
        );
      }

      return jestInitGenerator(host, {
        skipPackageJson: options.skipPackageJson,
      });
    default:
      return () => {};
  }
}

function addE2ETestRunner(host: Tree, options: Schema): GeneratorCallback {
  switch (options.e2eTestRunner) {
    case E2eTestRunner.Protractor:
      return !options.skipPackageJson
        ? addDependenciesToPackageJson(
            host,
            {},
            {
              protractor: '~7.0.0',
              'jasmine-core': '~3.6.0',
              'jasmine-spec-reporter': '~5.0.0',
              'ts-node': '~9.1.1',
              '@types/jasmine': '~3.6.0',
              '@types/jasminewd2': '~2.0.3',
            }
          )
        : () => {};
    case E2eTestRunner.Cypress:
      return cypressInitGenerator(host, {
        skipPackageJson: options.skipPackageJson,
      });
    default:
      return () => {};
  }
}

function addGitIgnoreEntry(host: Tree, entry: string) {
  if (host.exists('.gitignore')) {
    let content = host.read('.gitignore', 'utf-8');
    if (/^\.angular$/gm.test(content)) {
      return;
    }

    content = `${content}\n${entry}\n`;
    host.write('.gitignore', content);
  } else {
    logger.warn(`Couldn't find .gitignore file to update`);
  }
}

export default angularInitGenerator;
