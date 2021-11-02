import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { formatFiles, insert } from '@nrwl/workspace';
import * as ts from 'typescript';
import {
  getSourceNodes,
  RemoveChange,
} from '@nrwl/workspace/src/utils/ast-utils';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

export default function update(): Rule {
  return chain([
    addPassWithNoTestsToWorkspace,
    removePassWithNoTestsFromJestConfig,
    formatFiles(),
  ]);
}

const addPassWithNoTestsToWorkspace = updateWorkspace((workspace) => {
  workspace.projects.forEach((project) => {
    project.targets.forEach((target) => {
      if (
        target.builder === '@nrwl/jest:jest' &&
        target.options &&
        target.options.passWithNoTests === undefined
      ) {
        target.options.passWithNoTests = true;
      }
    });
  });
});

function removePassWithNoTestsFromJestConfig(host: Tree) {
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
        node.name.text === 'passWithNoTests'
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
