import {
  applyChangesToString,
  ChangeType,
  StringChange,
  Tree,
} from '@nrwl/devkit';
import * as ts from 'typescript';
import { getSourceNodes } from '@nrwl/workspace/src/utils/ast-utils';

import { Schema } from '../schema';

/**
 * Updates the root jest config projects array and removes the project.
 */
export function updateJestConfig(tree: Tree, schema: Schema) {
  const projectToRemove = schema.projectName;

  if (!tree.exists('jest.config.js')) {
    return;
  }

  const contents = tree.read('jest.config.js').toString();
  const sourceFile = ts.createSourceFile(
    'jest.config.js',
    contents,
    ts.ScriptTarget.Latest
  );

  const changes: StringChange[] = [];
  const sourceNodes = getSourceNodes(sourceFile);

  sourceNodes.forEach((node) => {
    if (
      ts.isToken(node) &&
      ts.isStringLiteral(node) &&
      node.text.includes(projectToRemove)
    ) {
      changes.push({
        type: ChangeType.Delete,
        start: node.getStart(sourceFile),
        length: node.getFullText(sourceFile).length,
      });
    }
  });
  tree.write('jest.config.js', applyChangesToString(contents, changes));
}
