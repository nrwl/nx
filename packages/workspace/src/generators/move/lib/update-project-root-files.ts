import { updateJson, ProjectConfiguration, Tree } from '@nx/devkit';
import { workspaceRoot } from '@nx/devkit';
import * as path from 'path';
import { extname, join } from 'path';
import { NormalizedSchema } from '../schema';
const allowedExt = ['.ts', '.js', '.json'];

/**
 * Updates the files in the root of the project
 *
 * Typically these are config files which point outside of the project folder
 *
 * @param schema The options provided to the schematic
 */
export function updateProjectRootFiles(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
): void {
  if (project.root === '.') {
    // Need to handle root project differently since replacing '.' with 'dir',
    // for example, // will change '../../' to 'dirdir/dirdir/'.
    updateFilesForRootProjects(tree, schema, project);
  } else {
    updateFilesForNonRootProjects(tree, schema, project);
  }
}

export function updateFilesForRootProjects(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
): void {
  // Skip updating "path" and "extends" for tsconfig files since they are mostly
  // relative to the project root. The only exception is tsconfig.json that
  // should extend from ../../tsconfig.base.json. We'll handle this separately.
  const regex = /(?<!"path".+)(?<!"extends".+)(?<=['"])\.\/(?=[a-zA-Z0-9])/g;
  const newRelativeRoot =
    // Normalize separators
    path
      .relative(
        path.join(workspaceRoot, schema.relativeToRootDestination),
        workspaceRoot
      )
      .split(path.sep)
      // Include trailing slash because the regex matches the trailing slash in "./"
      .join('/') + '/';

  for (const file of tree.children(schema.relativeToRootDestination)) {
    const ext = extname(file);
    if (!allowedExt.includes(ext)) {
      continue;
    }
    if (file === '.eslintrc.json' || file === 'eslint.config.js') {
      continue;
    }

    const oldContent = tree.read(
      join(schema.relativeToRootDestination, file),
      'utf-8'
    );
    let newContent = oldContent.replace(regex, newRelativeRoot);
    if (file === 'tsconfig.json') {
      // Since we skipped updating "extends" earlier, need to point to the base config.
      newContent = newContent.replace(
        `./tsconfig.base.json`,
        newRelativeRoot + `tsconfig.base.json`
      );
    }
    tree.write(join(schema.relativeToRootDestination, file), newContent);
  }
}

export function updateFilesForNonRootProjects(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
): void {
  const newRelativeRoot =
    path
      .relative(
        path.join(workspaceRoot, schema.relativeToRootDestination),
        workspaceRoot
      )
      .split(path.sep)
      .join('/') + '/';
  const oldRelativeRoot = path
    .relative(path.join(workspaceRoot, project.root), workspaceRoot)
    .split(path.sep)
    .join('/');

  if (newRelativeRoot === oldRelativeRoot) {
    // nothing to do
    return;
  }

  const dots = /\./g;
  const regex = new RegExp(
    `(?<!\\.\\.\\/)${oldRelativeRoot.replace(dots, '\\.')}\/(?!\\.\\.\\/)`,
    'g'
  );
  for (const file of tree.children(schema.relativeToRootDestination)) {
    const ext = extname(file);
    if (!allowedExt.includes(ext)) {
      continue;
    }
    if (file === '.eslintrc.json' || file === 'eslint.config.js') {
      continue;
    }

    const oldContent = tree.read(
      join(schema.relativeToRootDestination, file),
      'utf-8'
    );
    let newContent = oldContent.replace(regex, newRelativeRoot);
    if (file == 'tsconfig.json') {
      newContent = newContent.replace('tsconfig.json', 'tsconfig.base.json');
    }
    tree.write(join(schema.relativeToRootDestination, file), newContent);
  }
}
