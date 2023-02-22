import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { Linter } from '@nrwl/linter';
import { initGenerator as jsInitGenerator } from '@nrwl/js';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { join } from 'path';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  angularDevkitVersion,
  angularVersion,
  jasmineCoreVersion,
  jasmineSpecReporterVersion,
  jestPresetAngularVersion,
  protractorVersion,
  rxjsVersion,
  tsLibVersion,
  tsNodeVersion,
  typesJasmineVersion,
  typesJasminewd2Version,
  zoneJsVersion,
} from '../../utils/versions';
import { karmaGenerator } from '../karma/karma';
import {
  addDependenciesToPackageJsonIfDontExist,
  getGeneratorDirectoryForInstalledAngularVersion,
  getInstalledPackageVersion,
} from '../utils/version-utils';
import { Schema } from './schema';

export async function angularInitGenerator(
  tree: Tree,
  rawOptions: Schema
): Promise<GeneratorCallback> {
  const generatorDirectory =
    getGeneratorDirectoryForInstalledAngularVersion(tree);
  if (generatorDirectory) {
    let previousGenerator = await import(
      join(__dirname, generatorDirectory, 'init')
    );
    await previousGenerator.default(tree, rawOptions);
    return;
  }

  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(rawOptions);

  const peerDepsToInstall = [
    '@angular-devkit/core',
    '@angular-devkit/schematics',
    '@schematics/angular',
  ];
  let devkitVersion: string;
  peerDepsToInstall.forEach((pkg) => {
    const packageVersion = getInstalledPackageVersion(tree, pkg);

    if (!packageVersion) {
      devkitVersion ??=
        getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
        angularDevkitVersion;

      try {
        ensurePackage(pkg, devkitVersion);
      } catch {
        // @schematics/angular cannot be required so this fails but this will still allow wrapping the schematic later on
      }

      if (!options.skipPackageJson) {
        tasks.push(
          addDependenciesToPackageJson(tree, {}, { [pkg]: devkitVersion })
        );
      }
    }
  });
  setDefaults(tree, options);

  const jsTask = await jsInitGenerator(tree, {
    ...options,
    tsConfigName: options.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    js: false,
    skipFormat: true,
  });
  tasks.push(jsTask);

  if (!options.skipPackageJson) {
    tasks.push(updateDependencies(tree));
  }
  const unitTestTask = await addUnitTestRunner(tree, options);
  tasks.push(unitTestTask);
  const e2eTask = await addE2ETestRunner(tree, options);
  tasks.push(e2eTask);

  addGitIgnoreEntry(tree, '.angular');

  if (!options.skipFormat) {
    await formatFiles(tree);
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
  const angularVersionToInstall =
    getInstalledPackageVersion(tree, '@angular/core') ?? angularVersion;
  const angularDevkitVersionToInstall =
    getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
    angularDevkitVersion;

  return addDependenciesToPackageJsonIfDontExist(
    tree,
    {
      '@angular/animations': angularVersionToInstall,
      '@angular/common': angularVersionToInstall,
      '@angular/compiler': angularVersionToInstall,
      '@angular/core': angularVersionToInstall,
      '@angular/forms': angularVersionToInstall,
      '@angular/platform-browser': angularVersionToInstall,
      '@angular/platform-browser-dynamic': angularVersionToInstall,
      '@angular/router': angularVersionToInstall,
      rxjs: rxjsVersion,
      tslib: tsLibVersion,
      'zone.js': zoneJsVersion,
    },
    {
      '@angular/cli': angularDevkitVersionToInstall,
      '@angular/compiler-cli': angularVersionToInstall,
      '@angular/language-service': angularVersionToInstall,
      '@angular-devkit/build-angular': angularDevkitVersionToInstall,
    }
  );
}

async function addUnitTestRunner(
  tree: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Karma:
      return await karmaGenerator(tree, {
        skipPackageJson: options.skipPackageJson,
      });
    case UnitTestRunner.Jest:
      if (!options.skipPackageJson) {
        addDependenciesToPackageJsonIfDontExist(
          tree,
          {},
          {
            'jest-preset-angular': jestPresetAngularVersion,
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
              protractor: protractorVersion,
              'jasmine-core': jasmineCoreVersion,
              'jasmine-spec-reporter': jasmineSpecReporterVersion,
              'ts-node': tsNodeVersion,
              '@types/jasmine': typesJasmineVersion,
              '@types/jasminewd2': typesJasminewd2Version,
            }
          )
        : () => {};
    case E2eTestRunner.Cypress:
      return cypressInitGenerator(tree, {
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
