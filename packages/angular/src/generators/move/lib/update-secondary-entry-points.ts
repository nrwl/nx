import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  normalizePath,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname } from 'path';
import { readLibraryBuilderEntryPoints } from '../../utils/entry-point';
import { usesLibraryBuilder, usesNgPackagr } from '../../utils/project';
import type { MoveImplOptions } from './types';

export function updateSecondaryEntryPoints(
  tree: Tree,
  schema: MoveImplOptions
): void {
  if (schema.oldProjectName === schema.newProjectName) {
    return;
  }

  const project = readProjectConfiguration(tree, schema.newProjectName);

  if (project.projectType !== 'library') {
    return;
  }

  // The name replacement isn't idempotent, so each README is updated once even
  // when both layouts list its directory.
  const entryPointDirs = new Set<string>();
  if (usesNgPackagr(project)) {
    visitNotIgnoredFiles(tree, project.root, (filePath) => {
      if (
        basename(filePath) === 'ng-package.json' &&
        normalizePath(filePath) !==
          joinPathFragments(project.root, 'ng-package.json')
      ) {
        entryPointDirs.add(dirname(filePath));
      }
    });
  }
  if (usesLibraryBuilder(tree, schema.newProjectName)) {
    for (const { subpath } of readLibraryBuilderEntryPoints(
      tree,
      project.root
    )) {
      if (subpath !== '.') {
        entryPointDirs.add(joinPathFragments(project.root, subpath));
      }
    }
  }

  for (const dir of entryPointDirs) {
    updateReadme(tree, dir, schema.oldProjectName, schema.newProjectName);
  }
}

function updateReadme(
  tree: Tree,
  dir: string,
  oldProjectName: string,
  newProjectName: string
) {
  const readmePath = joinPathFragments(dir, 'README.md');
  if (!tree.exists(readmePath)) {
    return;
  }

  const findName = new RegExp(`${oldProjectName}`, 'g');
  const oldContent = tree.read(readmePath, 'utf-8');
  const newContent = oldContent.replace(findName, newProjectName);
  tree.write(readmePath, newContent);
}
