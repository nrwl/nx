import { Rule, Tree, chain } from '@angular-devkit/schematics';
import { insert, formatFiles } from '@nrwl/workspace';
import * as ts from 'typescript';
import {
  getSourceNodes,
  RemoveChange,
} from '@nrwl/workspace/src/utils/ast-utils';

function updateJestConfig(host: Tree) {
  if (host.exists('jest.config.js')) {
    const contents = host.read('jest.config.js').toString();
    const sourceFile = ts.createSourceFile(
      'jest.config.js',
      contents,
      ts.ScriptTarget.Latest
    );
    const changes: RemoveChange[] = [];
    const sourceNodes = getSourceNodes(sourceFile);
    sourceNodes.forEach((node, index) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'collectCoverage'
      ) {
        const expectedCommaNode = sourceNodes[index + 4];
        const isFollowedByComma =
          expectedCommaNode.kind === ts.SyntaxKind.CommaToken;
        changes.push(
          new RemoveChange(
            'jest.config.js',
            node.getStart(sourceFile),
            isFollowedByComma
              ? node.getFullText(sourceFile)
              : node.getText(sourceFile)
          )
        );
      }
    });
    insert(host, 'jest.config.js', changes);
  }
}

export default function (): Rule {
  return chain([updateJestConfig, formatFiles()]);
}
