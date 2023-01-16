import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { backwardCompatibleVersions } from '../../../utils/backward-compatible-versions';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import { karmaGenerator } from '../../karma/karma';
import { Schema } from './schema';

export async function angularInitGenerator(
  host: Tree,
  rawOptions: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  setDefaults(host, options);

  const depsTask = !options.skipPackageJson
    ? updateDependencies(host)
    : () => {};
  const unitTestTask = await addUnitTestRunner(host, options);
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
  const nxJson = readNxJson(host);

  nxJson.generators = nxJson.generators || {};
  nxJson.generators['@nrwl/angular:application'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    ...(nxJson.generators['@nrwl/angular:application'] || {}),
  };
  nxJson.generators['@nrwl/angular:library'] = {
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    ...(nxJson.generators['@nrwl/angular:library'] || {}),
  };
  nxJson.generators['@nrwl/angular:component'] = {
    style: options.style,
    ...(nxJson.generators['@nrwl/angular:component'] || {}),
  };

  updateNxJson(host, nxJson);
}

function updateDependencies(host: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    host,
    {
      '@angular/animations':
        backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/common': backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/compiler': backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/core': backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/forms': backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/platform-browser':
        backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/platform-browser-dynamic':
        backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/router': backwardCompatibleVersions.angularV14.angularVersion,
      rxjs: backwardCompatibleVersions.angularV14.rxjsVersion,
      tslib: backwardCompatibleVersions.angularV14.tsLibVersion,
      'zone.js': backwardCompatibleVersions.angularV14.zoneJsVersion,
    },
    {
      '@angular/cli':
        backwardCompatibleVersions.angularV14.angularDevkitVersion,
      '@angular/compiler-cli':
        backwardCompatibleVersions.angularV14.angularVersion,
      '@angular/language-service':
        backwardCompatibleVersions.angularV14.angularVersion,
      '@angular-devkit/build-angular':
        backwardCompatibleVersions.angularV14.angularDevkitVersion,
    }
  );
}

async function addUnitTestRunner(
  host: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Karma:
      return await karmaGenerator(host, {
        skipPackageJson: options.skipPackageJson,
      });
    case UnitTestRunner.Jest:
      if (!options.skipPackageJson) {
        addDependenciesToPackageJson(
          host,
          {},
          {
            'jest-preset-angular':
              backwardCompatibleVersions.angularV14.jestPresetAngularVersion,
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
              protractor:
                backwardCompatibleVersions.angularV14.protractorVersion,
              'jasmine-core':
                backwardCompatibleVersions.angularV14.jasmineCoreVersion,
              'jasmine-spec-reporter':
                backwardCompatibleVersions.angularV14
                  .jasmineSpecReporterVersion,
              'ts-node': backwardCompatibleVersions.angularV14.tsNodeVersion,
              '@types/jasmine':
                backwardCompatibleVersions.angularV14.typesJasmineVersion,
              '@types/jasminewd2':
                backwardCompatibleVersions.angularV14.typesJasminewd2Version,
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
