import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace, insert, RemoveChange } from '@nrwl/workspace';
import * as ts from 'typescript';
import { getSourceNodes } from '@nrwl/workspace/src/utils/ast-utils';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Updates the root jest config projects array and removes the project.
 *
 * @param schema The options provided to the schematic
 */
export function updateJestConfig(schema) {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((_) => {
        const projectToRemove = schema.projectName;

        if (!tree.exists('jest.config.js')) {
          return tree;
        }

        const contents = tree.read('jest.config.js').toString();
        const sourceFile = ts.createSourceFile(
          'jest.config.js',
          contents,
          ts.ScriptTarget.Latest
        );

        const changes: RemoveChange[] = [];
        const sourceNodes = getSourceNodes(sourceFile);

        sourceNodes.forEach((node, index) => {
          if (
            ts.isToken(node) &&
            ts.isStringLiteral(node) &&
            node.text.includes(projectToRemove)
          ) {
            changes.push(
              new RemoveChange(
                'jest.config.js',
                node.getStart(sourceFile),
                node.getFullText(sourceFile)
              )
            );
          }
        });
        insert(tree, 'jest.config.js', changes);

        return tree;
      })
    );
  };
}
