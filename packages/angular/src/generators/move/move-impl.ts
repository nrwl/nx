import { createProjectGraphAsync, type Tree } from '@nx/devkit';
import {
  updateModuleName,
  updateNgPackage,
  updateSecondaryEntryPoints,
} from './lib';
import type { MoveImplOptions } from './lib/types';

/**
 * Angular-specific logic to move a project to another directory.
 * This is invoked by the `@nx/workspace:move` generator.
 */
export async function move(
  tree: Tree,
  options: MoveImplOptions
): Promise<void> {
  // while the project has already being moved at this point, the changes are
  // still in the virtual tree and haven't been committed, so the project graph
  // still contains the old project name
  if (!(await isAngularProject(options.oldProjectName))) {
    return;
  }

  updateModuleName(tree, options);
  updateNgPackage(tree, options);
  updateSecondaryEntryPoints(tree, options);
}

async function isAngularProject(project: string): Promise<boolean> {
  const projectGraph = await createProjectGraphAsync();

  return projectGraph.dependencies[project]?.some(
    (dependency) => dependency.target === 'npm:@angular/core'
  );
}
