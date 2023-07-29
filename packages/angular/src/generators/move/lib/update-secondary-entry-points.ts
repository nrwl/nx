import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  normalizePath,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname } from 'path';
import type { NormalizedSchema } from '../schema';

const libraryExecutors = [
  '@angular-devkit/build-angular:ng-packagr',
  '@nx/angular:ng-packagr-lite',
  '@nx/angular:package',
  // TODO(v17): remove when @nrwl/* scope is removed
  '@nrwl/angular:ng-packagr-lite',
  '@nrwl/angular:package',
];

export function updateSecondaryEntryPoints(
  tree: Tree,
  schema: NormalizedSchema
): void {
  const project = readProjectConfiguration(tree, schema.newProjectName);

  if (project.projectType !== 'library') {
    return;
  }

  if (
    !Object.values(project.targets ?? {}).some((target) =>
      libraryExecutors.includes(target.executor)
    )
  ) {
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
      schema.projectName,
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
