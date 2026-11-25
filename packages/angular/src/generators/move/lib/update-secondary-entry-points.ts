import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  normalizePath,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname } from 'path';
import { usesNgPackagr } from '../../utils/project';
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

  if (!usesNgPackagr(project)) {
    return;
  }

  visitNotIgnoredFiles(tree, project.root, (filePath) => {
    if (
      basename(filePath) !== 'ng-package.json' ||
      normalizePath(filePath) ===
        joinPathFragments(project.root, 'ng-package.json')
    ) {
      return;
    }

    updateReadme(
      tree,
      dirname(filePath),
      schema.oldProjectName,
      schema.newProjectName
    );
  });
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
