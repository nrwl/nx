import { ChangeType, applyChangesToString } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import ts = require('typescript');

export function fixCoverageAndRerporters(
  configContents: string
): string | undefined {
  const configNode = getConfigNode(configContents);
  if (!configNode) {
    return;
  }

  const testHasCoverage = tsquery.query(
    configNode,
    `PropertyAssignment:has(Identifier[name="test"]):has(PropertyAssignment:has(Identifier[name="coverage"]))`
  )?.[0];
  let changes = [];

  if (testHasCoverage) {
    const testObjectLiteralExpressionNode = tsquery.query(
      testHasCoverage,
      `ObjectLiteralExpression:has(Identifier[name="coverage"])`
    )?.[0];
    const coverageNode = findCoverageNode(testObjectLiteralExpressionNode);

    if (!coverageNode) {
      return;
    }

    const linesNode = tsquery.query(
      coverageNode,
      `PropertyAssignment:has(Identifier[name="lines"])`
    )?.[0];

    const statementsNode = tsquery.query(
      coverageNode,
      `PropertyAssignment:has(Identifier[name="statements"])`
    )?.[0];

    const functionsNode = tsquery.query(
      coverageNode,
      `PropertyAssignment:has(Identifier[name="functions"])`
    )?.[0];

    const branchesNode = tsquery.query(
      coverageNode,
      `PropertyAssignment:has(Identifier[name="branches"])`
    )?.[0];

    if (linesNode) {
      changes.push({
        type: ChangeType.Delete,
        start: linesNode.getStart(),
        length: linesNode.getWidth() + 1,
      });
    }
    if (statementsNode) {
      changes.push({
        type: ChangeType.Delete,
        start: statementsNode.getStart(),
        length: statementsNode.getWidth() + 1,
      });
    }

    if (functionsNode) {
      changes.push({
        type: ChangeType.Delete,
        start: functionsNode.getStart(),
        length: functionsNode.getWidth() + 1,
      });
    }

    if (branchesNode) {
      changes.push({
        type: ChangeType.Delete,
        start: branchesNode.getStart(),
        length: branchesNode.getWidth() + 1,
      });
    }

    if (branchesNode || functionsNode || statementsNode || linesNode) {
      changes.push({
        type: ChangeType.Insert,
        index: coverageNode.getStart() + 1,
        text: `thresholds: {
        ${linesNode ? linesNode.getText() + ',' : ''}
        ${statementsNode ? statementsNode.getText() + ',' : ''}
        ${functionsNode ? functionsNode.getText() + ',' : ''}
        ${branchesNode ? branchesNode.getText() + ',' : ''}
      },`,
      });
    }
  }

  const testHasReporters = tsquery.query(
    configNode,
    `PropertyAssignment:has(Identifier[name="test"]):has(PropertyAssignment:has(Identifier[name="reporters"]))`
  )?.[0];

  if (!testHasReporters) {
    const testObject = tsquery.query(
      configNode,
      `PropertyAssignment:has(Identifier[name="test"])`
    )?.[0];
    changes.push({
      type: ChangeType.Insert,
      index: testObject.getStart() + `test: {`.length + 1,
      text: `reporters: ['default'],`,
    });
  }

  if (changes.length > 0) {
    return applyChangesToString(configContents, changes);
  } else {
    return;
  }
}

export function getConfigNode(configFileContents: string): ts.Node | undefined {
  if (!configFileContents) {
    return;
  }
  let configNode = tsquery.query(
    configFileContents,
    `ObjectLiteralExpression`
  )?.[0];

  const arrowFunctionReturnStatement = tsquery.query(
    configFileContents,
    `ArrowFunction Block ReturnStatement ObjectLiteralExpression`
  )?.[0];

  if (arrowFunctionReturnStatement) {
    configNode = arrowFunctionReturnStatement;
  }

  return configNode;
}

function findCoverageNode(testNode: ts.Node) {
  let coverageNode: ts.Node | undefined;
  testNode.forEachChild((child) => {
    if (ts.isPropertyAssignment(child) && child.name.getText() === 'coverage') {
      coverageNode = child.initializer;
    }
  });
  return coverageNode;
}
