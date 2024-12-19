import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  ensurePackage,
  formatFiles,
  type GeneratorCallback,
  logger,
  readNxJson,
  type Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { createNodesV2 } from '../../plugins/plugin';
import { getInstalledPackageVersion, versions } from '../utils/version-utils';
import { Schema } from './schema';

export async function angularInitGenerator(
  tree: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  assertNotUsingTsSolutionSetup(tree, 'angular', 'init');

  ignoreAngularCacheDirectory(tree);
  const installTask = installAngularDevkitCoreIfMissing(tree, options);

  // For Angular inference plugin, we only want it during import since our
  // generators do not use `angular.json`, and `nx init` should split
  // `angular.json` into multiple `project.json` files -- as this is preferred
  // by most folks we've talked to.
  options.addPlugin ??= process.env.NX_RUNNING_NX_IMPORT === 'true';

  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/angular/plugin',
      createNodesV2,
      {
        targetNamePrefix: ['', 'angular:', 'angular-'],
      },
      options.updatePackageScripts
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function installAngularDevkitCoreIfMissing(
  tree: Tree,
  options: Schema
): GeneratorCallback {
  const packageVersion = getInstalledPackageVersion(
    tree,
    '@angular-devkit/core'
  );

  if (!packageVersion) {
    const pkgVersions = versions(tree);
    const devkitVersion =
      getInstalledPackageVersion(tree, '@angular-devkit/build-angular') ??
      pkgVersions.angularDevkitVersion;

    try {
      ensurePackage('@angular-devkit/core', devkitVersion);
    } catch {
      // @schematics/angular cannot be required so this fails but this will still allow wrapping the schematic later on
    }

    if (!options.skipPackageJson) {
      return addDependenciesToPackageJson(
        tree,
        {},
        { ['@angular-devkit/core']: devkitVersion },
        undefined,
        options.keepExistingVersions
      );
    }
  }

  return () => {};
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
  if (/^\.angular(\/cache)?$/gm.test(content)) {
    return;
  }

  content = `${content}\n${entry}\n`;
  tree.write('.prettierignore', content);
}

export default angularInitGenerator;
