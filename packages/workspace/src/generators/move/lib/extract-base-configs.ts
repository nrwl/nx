import {
  getProjects,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';

export function maybeExtractTsConfigBase(tree: Tree): void {
  let extractTsConfigBase: any;
  try {
    extractTsConfigBase = require('@nx/' + 'js').extractTsConfigBase;
  } catch {
    // Not installed, skip
    return;
  }
  extractTsConfigBase(tree);
}

export async function maybeExtractJestConfigBase(tree: Tree): Promise<void> {
  let jestInitGenerator: any;
  try {
    jestInitGenerator = require('@nx/' + 'jest').jestInitGenerator;
  } catch {
    // Not installed, skip
    return;
  }
  await jestInitGenerator(tree, {});
}

export function maybeMigrateEslintConfigIfRootProject(
  tree: Tree,
  rootProject: ProjectConfiguration
): void {
  let migrateConfigToMonorepoStyle: any;
  try {
    migrateConfigToMonorepoStyle = require('@nx/' +
      'eslint/src/generators/init/init-migration').migrateConfigToMonorepoStyle;
  } catch {
    // eslint not installed
  }
  migrateConfigToMonorepoStyle?.(
    Array.from(getProjects(tree).values()),
    tree,
    tree.exists(joinPathFragments(rootProject.root, 'jest.config.ts')) ||
      tree.exists(joinPathFragments(rootProject.root, 'jest.config.js'))
      ? 'jest'
      : 'none'
  );
}
