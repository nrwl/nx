import {
  applyChangesToString,
  ChangeType,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { getSourceNodes } from '../../../utilities/typescript/get-source-nodes';

import { Schema } from '../schema';
import type {
  ArrayLiteralExpression,
  PropertyAssignment,
  StringLiteral,
} from 'typescript';
import { join } from 'path';
import { ensureTypescript } from '../../../utilities/typescript';
import { findRootJestConfig } from '../../utils/jest-config';

let tsModule: typeof import('typescript');

function isUsingUtilityFunction(host: Tree) {
  const rootConfigPath = findRootJestConfig(host);
  if (!rootConfigPath) {
    return false;
  }

  const rootConfig = host.read(rootConfigPath, 'utf-8');

  return (
    rootConfig.includes('getJestProjects()') ||
    rootConfig.includes('getJestProjectsAsync()')
  );
}

/**
 * in a standalone project, the root jest.config.ts is a project config instead
 * of multi-project config.
 * in that case we do not need to edit it to remove it
 **/
function isMonorepoConfig(tree: Tree) {
  const rootConfigPath = findRootJestConfig(tree);
  if (!rootConfigPath) {
    return false;
  }

  return tree.read(rootConfigPath, 'utf-8').includes('projects:');
}

/**
 * Updates the root jest config projects array and removes the project.
 */
export function updateJestConfig(
  tree: Tree,
  schema: Schema,
  projectConfig: ProjectConfiguration
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const {
    createSourceFile,
    ScriptTarget,
    isPropertyAssignment,
    isArrayLiteralExpression,
    isStringLiteral,
  } = tsModule;
  const projectToRemove = schema.projectName;

  const rootConfigPath = findRootJestConfig(tree);

  if (
    !rootConfigPath ||
    !tree.exists(rootConfigPath) ||
    !tree.exists(join(projectConfig.root, 'jest.config.ts')) ||
    isUsingUtilityFunction(tree) ||
    !isMonorepoConfig(tree)
  ) {
    return;
  }

  const contents = tree.read(rootConfigPath, 'utf-8');
  const sourceFile = createSourceFile(
    rootConfigPath,
    contents,
    ScriptTarget.Latest
  );

  const sourceNodes = getSourceNodes(sourceFile);

  const projectsAssignment = sourceNodes.find(
    (node) =>
      isPropertyAssignment(node) &&
      node.name.getText(sourceFile) === 'projects' &&
      isArrayLiteralExpression(node.initializer)
  ) as PropertyAssignment;

  if (!projectsAssignment) {
    throw Error(
      `Could not remove ${projectToRemove} from projects in /jest.config.ts. Please remove ${projectToRemove} from your projects.`
    );
  }
  const projectsArray =
    projectsAssignment.initializer as ArrayLiteralExpression;

  const project = projectsArray.elements.find(
    (item) =>
      isStringLiteral(item) &&
      item.text.startsWith(`<rootDir>/${projectConfig.root}`)
  ) as StringLiteral;

  if (!project) {
    console.warn(
      `Could not find ${projectToRemove} in projects in /jest.config.ts.`
    );
    return;
  }

  const previousProject =
    projectsArray.elements[projectsArray.elements.indexOf(project) - 1];

  const start = previousProject
    ? previousProject.getEnd()
    : project.getStart(sourceFile);

  tree.write(
    rootConfigPath,
    applyChangesToString(contents, [
      {
        type: ChangeType.Delete,
        start,
        length: project.getEnd() - start,
      },
    ])
  );
}
