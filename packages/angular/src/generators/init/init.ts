import { cypressInitGenerator } from '@nx/cypress';
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
} from '@nx/devkit';
import { jestInitGenerator } from '@nx/jest';
import { Linter } from '@nx/linter';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import {
  addDependenciesToPackageJsonIfDontExist,
  getInstalledPackageVersion,
  versions,
} from '../utils/version-utils';
import type { PackageVersions } from '../../utils/backward-compatible-versions';
import { Schema } from './schema';

export async function angularInitGenerator(
  tree: Tree,
  rawOptions: Schema
): Promise<GeneratorCallback> {
  const tasks: GeneratorCallback[] = [];
  const options = normalizeOptions(rawOptions);

  const pkgVersions = versions(tree);

  const peerDepsToInstall = ['@angular-devkit/core'];
  let devkitVersion: string;
  peerDepsToInstall.forEach((pkg) => {
    const packageVersion = getInstalledPackageVersion(tree, pkg);

    if (!packageVersion) {
      devkitVersion ??=
        getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
        pkgVersions.angularDevkitVersion;

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
    tasks.push(updateDependencies(tree, pkgVersions));
  }
  const unitTestTask = await addUnitTestRunner(
    tree,
    options,
    pkgVersions.jestPresetAngularVersion
  );
  tasks.push(unitTestTask);
  const e2eTask = await addE2ETestRunner(tree, options);
  tasks.push(e2eTask);

  ignoreAngularCacheDirectory(tree);

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
  nxJson.generators['@nx/angular:application'] = {
    style: options.style,
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    ...(nxJson.generators['@nx/angular:application'] || {}),
  };
  nxJson.generators['@nx/angular:library'] = {
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    ...(nxJson.generators['@nx/angular:library'] || {}),
  };
  nxJson.generators['@nx/angular:component'] = {
    style: options.style,
    ...(nxJson.generators['@nx/angular:component'] || {}),
  };

  updateNxJson(host, nxJson);
}

function updateDependencies(
  tree: Tree,
  versions: PackageVersions
): GeneratorCallback {
  const angularVersion =
    getInstalledPackageVersion(tree, '@angular/core') ??
    versions.angularVersion;
  const angularDevkitVersion =
    getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
    versions.angularDevkitVersion;
  const rxjsVersion =
    getInstalledPackageVersion(tree, 'rxjs') ?? versions.rxjsVersion;
  const tsLibVersion =
    getInstalledPackageVersion(tree, 'tslib') ?? versions.tsLibVersion;
  const zoneJsVersion =
    getInstalledPackageVersion(tree, 'zone.js') ?? versions.zoneJsVersion;

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
      rxjs: rxjsVersion,
      tslib: tsLibVersion,
      'zone.js': zoneJsVersion,
    },
    {
      '@angular/cli': angularDevkitVersion,
      '@angular/compiler-cli': angularVersion,
      '@angular/language-service': angularVersion,
      '@angular-devkit/build-angular': angularDevkitVersion,
      '@angular-devkit/schematics': angularDevkitVersion,
      '@schematics/angular': angularDevkitVersion,
    }
  );
}

async function addUnitTestRunner(
  tree: Tree,
  options: Schema,
  jestPresetAngularVersion: string
): Promise<GeneratorCallback> {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Jest:
      if (!options.skipPackageJson) {
        process.env.npm_config_legacy_peer_deps ??= 'true';

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
    case E2eTestRunner.Cypress:
      return cypressInitGenerator(tree, {
        skipPackageJson: options.skipPackageJson,
      });
    default:
      return () => {};
  }
}

function ignoreAngularCacheDirectory(tree: Tree): void {
  const { cli } = readNxJson(tree);
  // angular-specific cli config is supported though is not included in the
  // NxJsonConfiguration type
  const angularCacheDir = (cli as any)?.cache?.path ?? '.angular';

  addGitIgnoreEntry(tree, angularCacheDir);
  addPrettierIgnoreEntry(tree, angularCacheDir);
}

function addGitIgnoreEntry(tree: Tree, entry: string): void {
  if (tree.exists('.gitignore')) {
    let content = tree.read('.gitignore', 'utf-8');
    if (/^\.angular$/gm.test(content)) {
      return;
    }

    content = `${content}\n${entry}\n`;
    tree.write('.gitignore', content);
  } else {
    logger.warn(`Couldn't find .gitignore file to update`);
  }
}

function addPrettierIgnoreEntry(tree: Tree, entry: string): void {
  if (!tree.exists('.prettierignore')) {
    return;
  }

  let content = tree.read('.prettierignore', 'utf-8');
  if (/^\.angular$/gm.test(content)) {
    return;
  }

  content = `${content}\n${entry}\n`;
  tree.write('.prettierignore', content);
}

export default angularInitGenerator;
