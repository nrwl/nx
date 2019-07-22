import { Rule, Tree } from '@angular-devkit/schematics';
import { insert } from '@nrwl/workspace';
import * as ts from 'typescript';
import {
  getSourceNodes,
  RemoveChange
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

    getSourceNodes(sourceFile).forEach(node => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'collectCoverage'
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
    insert(host, 'jest.config.js', changes);
  }
}

export default function(): Rule {
  return updateJestConfig;
}
