import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  logger,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import { karmaGenerator } from '../../karma/karma';
import { Schema } from './schema';
import { versions } from '../../../utils/versions';

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
}

function updateDependencies(host: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    host,
    {
      '@angular/animations': versions.angularV14.angularVersion,
      '@angular/common': versions.angularV14.angularVersion,
      '@angular/compiler': versions.angularV14.angularVersion,
      '@angular/core': versions.angularV14.angularVersion,
      '@angular/forms': versions.angularV14.angularVersion,
      '@angular/platform-browser': versions.angularV14.angularVersion,
      '@angular/platform-browser-dynamic': versions.angularV14.angularVersion,
      '@angular/router': versions.angularV14.angularVersion,
      rxjs: versions.angularV14.rxjsVersion,
      tslib: versions.angularV14.tsLibVersion,
      'zone.js': versions.angularV14.zoneJsVersion,
    },
    {
      '@angular/cli': versions.angularV14.angularDevkitVersion,
      '@angular/compiler-cli': versions.angularV14.angularVersion,
      '@angular/language-service': versions.angularV14.angularVersion,
      '@angular-devkit/build-angular': versions.angularV14.angularDevkitVersion,
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
            'jest-preset-angular': versions.angularV14.jestPresetAngularVersion,
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
              protractor: versions.angularV14.protractorVersion,
              'jasmine-core': versions.angularV14.jasmineCoreVersion,
              'jasmine-spec-reporter':
                versions.angularV14.jasmineSpecReporterVersion,
              'ts-node': versions.angularV14.tsNodeVersion,
              '@types/jasmine': versions.angularV14.typesJasmineVersion,
              '@types/jasminewd2': versions.angularV14.typesJasminewd2Version,
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
