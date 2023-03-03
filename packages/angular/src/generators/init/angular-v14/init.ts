import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';
import { initGenerator as jsInitGenerator } from '@nrwl/js';

import { backwardCompatibleVersions } from '../../../utils/backward-compatible-versions';
import { E2eTestRunner, UnitTestRunner } from '../../../utils/test-runners';
import {
  addDependenciesToPackageJsonIfDontExist,
  getInstalledPackageVersion,
} from '../../utils/version-utils';
import { Schema } from './schema';

export async function angularInitGenerator(
  host: Tree,
  rawOptions: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(rawOptions);
  setDefaults(host, options);
  const tasks: GeneratorCallback[] = [];

  const peerDepsToInstall = [
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@schematics/angular',
  ];
  let devkitVersion: string;
  peerDepsToInstall.forEach((pkg) => {
    const packageVersion = getInstalledPackageVersion(host, pkg);

    if (!packageVersion) {
      devkitVersion ??=
        getInstalledPackageVersion(host, '@angular-devkit/build-angular') ??
        backwardCompatibleVersions.angularV14.angularDevkitVersion;

      try {
        ensurePackage(pkg, devkitVersion);
      } catch {
        // @schematics/angular cannot be required so this fails but this will still allow wrapping the schematic later on
      }

      if (!options.skipPackageJson) {
        tasks.push(
          addDependenciesToPackageJson(host, {}, { [pkg]: devkitVersion })
        );
      }
    }
  });

  const jsTask = await jsInitGenerator(host, {
    ...options,
    js: false,
    tsConfigName: options.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
  });
  tasks.push(jsTask);

  if (!options.skipPackageJson) {
    tasks.push(updateDependencies(host));
  }

  const unitTestTask = await addUnitTestRunner(host, options);
  tasks.push(unitTestTask);
  const e2eTask = await addE2ETestRunner(host, options);
  tasks.push(e2eTask);

  addGitIgnoreEntry(host, '.angular');

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
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
    rootProject: options.rootProject,
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

function updateDependencies(tree: Tree): GeneratorCallback {
  const angularVersion =
    getInstalledPackageVersion(tree, '@angular/core') ??
    backwardCompatibleVersions.angularV14.angularVersion;
  const angularDevkitVersion =
    getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
    backwardCompatibleVersions.angularV14.angularDevkitVersion;

  return addDependenciesToPackageJsonIfDontExist(
    tree,
    {
      '@angular/animations': angularVersion,
      '@angular/common': angularVersion,
      '@angular/compiler': angularVersion,
      '@angular/core': angularVersion,
      '@angular/forms': angularVersion,
      '@angular/platform-browser': angularVersion,
      '@angular/platform-browser-dynamic': angularVersion,
      '@angular/router': angularVersion,
      rxjs: backwardCompatibleVersions.angularV14.rxjsVersion,
      tslib: backwardCompatibleVersions.angularV14.tsLibVersion,
      'zone.js': backwardCompatibleVersions.angularV14.zoneJsVersion,
    },
    {
      '@angular/cli': angularDevkitVersion,
      '@angular/compiler-cli': angularVersion,
      '@angular/language-service': angularVersion,
      '@angular-devkit/build-angular': angularDevkitVersion,
    }
  );
}

async function addUnitTestRunner(
  tree: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Jest:
      if (!options.skipPackageJson) {
        addDependenciesToPackageJsonIfDontExist(
          tree,
          {},
          {
            'jest-preset-angular':
              backwardCompatibleVersions.angularV14.jestPresetAngularVersion,
          }
        );
      }

      return jestInitGenerator(tree, {
        skipPackageJson: options.skipPackageJson,
      });
    default:
      return () => {};
  }
}

async function addE2ETestRunner(
  tree: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  switch (options.e2eTestRunner) {
    case E2eTestRunner.Protractor:
      return !options.skipPackageJson
        ? addDependenciesToPackageJsonIfDontExist(
            tree,
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
      return await cypressInitGenerator(tree, {
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
