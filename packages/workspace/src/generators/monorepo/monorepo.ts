import {
  convertNxGenerator,
  getProjects,
  joinPathFragments,
  ProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { moveGenerator } from '../move/move';
import { Schema } from './schema';

export async function monorepoGenerator(tree: Tree, options: Schema) {
  const projects = getProjects(tree);
  const { extractTsConfigBase } = require('@nx/' + 'js');
  extractTsConfigBase(tree);

  maybeExtractJestConfigBase(tree);

  const nxJson = readNxJson(tree);
  nxJson.workspaceLayout = {
    // normalize paths without trailing slash
    appsDir: joinPathFragments(options.appsDir),
    libsDir: joinPathFragments(options.libsDir),
  };

  updateNxJson(tree, nxJson);

  for (const [_name, project] of projects) {
    maybeExtractEslintConfigIfRootProject(tree, project);
    await moveGenerator(tree, {
      projectName: project.name,
      destination: project.name,
      updateImportPath: project.projectType === 'library',
    });
  }
}

function maybeExtractJestConfigBase(tree: Tree): void {
  let jestInitGenerator: any;
  try {
    jestInitGenerator = require('@nx/' + 'jest').jestInitGenerator;
  } catch {
    // not installed
  }
  jestInitGenerator?.(tree, {});
}

function maybeExtractEslintConfigIfRootProject(
  tree: Tree,
  rootProject: ProjectConfiguration
): void {
  if (rootProject.root !== '.') return;
  if (tree.exists('.eslintrc.base.json')) return;
  let migrateConfigToMonorepoStyle: any;
  try {
    migrateConfigToMonorepoStyle = require('@nx/' +
      'linter/src/generators/init/init-migration').migrateConfigToMonorepoStyle;
  } catch {
    // linter not install
  }
  // Only need to handle migrating the root rootProject.
  // If other libs/apps exist, then this migration is already done by `@nx/linter:lint-rootProject` generator.
  migrateConfigToMonorepoStyle?.(
    [rootProject.name],
    tree,
    tree.exists(joinPathFragments(rootProject.root, 'jest.config.ts')) ||
      tree.exists(joinPathFragments(rootProject.root, 'jest.config.js'))
      ? 'jest'
      : 'none'
  );
}

export default monorepoGenerator;

export const monorepoSchematic = convertNxGenerator(monorepoGenerator);
