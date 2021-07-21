import {
  applyChangesToString,
  ChangeType,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { getSourceNodes } from '../../../utilities/typescript/get-source-nodes';

import { Schema } from '../schema';
import {
  ArrayLiteralExpression,
  createSourceFile,
  isArrayLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  PropertyAssignment,
  ScriptTarget,
  StringLiteral,
} from 'typescript';
import { join } from 'path';

function isUsingUtilityFunction(host: Tree) {
  return host.read('jest.config.js').toString().includes('getJestProjects()');
}

/**
 * Updates the root jest config projects array and removes the project.
 */
export function updateJestConfig(
  tree: Tree,
  schema: Schema,
  projectConfig: ProjectConfiguration
) {
  const projectToRemove = schema.projectName;

  if (
    !tree.exists('jest.config.js') ||
    !tree.exists(join(projectConfig.root, 'jest.config.js')) ||
    isUsingUtilityFunction(tree)
  ) {
    return;
  }

  const contents = tree.read('jest.config.js', 'utf-8');
  const sourceFile = createSourceFile(
    'jest.config.js',
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
      `Could not remove ${projectToRemove} from projects in /jest.config.js. Please remove ${projectToRemove} from your projects.`
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
      `Could not find ${projectToRemove} in projects in /jest.config.js.`
    );
    return;
  }

  const previousProject =
    projectsArray.elements[projectsArray.elements.indexOf(project) - 1];

  const start = previousProject
    ? previousProject.getEnd()
    : project.getStart(sourceFile);

  tree.write(
    'jest.config.js',
    applyChangesToString(contents, [
      {
        type: ChangeType.Delete,
        start,
        length: project.getEnd() - start,
      },
    ])
  );
}
