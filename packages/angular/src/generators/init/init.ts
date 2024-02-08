import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  logger,
  readNxJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersion, versions } from '../utils/version-utils';
import { Schema } from './schema';

export async function angularInitGenerator(
  tree: Tree,
  options: Schema
): Promise<GeneratorCallback> {
  ignoreAngularCacheDirectory(tree);
  const installTask = installAngularDevkitCoreIfMissing(tree, options);

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
