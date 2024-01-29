import {
  ChangeType,
  ProjectConfiguration,
  applyChangesToString,
  joinPathFragments,
  offsetFromRoot,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import ts = require('typescript');
import { getConfigNode, notFoundWarning } from '../update-vite-config';

export function updateTestConfig(
  configContents: string,
  projectConfig: ProjectConfiguration,
  configPath: string
): string {
  const configNode = getConfigNode(configContents);
  if (!configNode) {
    notFoundWarning(configPath);
    return configContents;
  }

  const testObject = tsquery.query(
    configNode,
    `PropertyAssignment:has(Identifier[name="test"])`
  )?.[0];
  let testCoverageDir: ts.Node;
  let testCoverage: ts.Node;
  let provider: ts.Node;
  let reporters: ts.Node;

  if (testObject) {
    testCoverage = tsquery.query(
      testObject,
      `PropertyAssignment:has(Identifier[name="coverage"])`
    )?.[0];
    reporters = tsquery.query(
      testObject,
      `PropertyAssignment:has(Identifier[name="reporters"])`
    )?.[0];
    if (testCoverage) {
      testCoverageDir = tsquery.query(
        testCoverage,
        `PropertyAssignment:has(Identifier[name="reportsDirectory"])`
      )?.[0];
      provider = tsquery.query(
        testCoverage,
        `PropertyAssignment:has(Identifier[name="provider"])`
      )?.[0];
    }
  }

  let coverageDir = '';

  if (projectConfig.targets?.test?.options?.reportsDirectory) {
    coverageDir = projectConfig.targets?.test?.options?.reportsDirectory;
  } else {
    coverageDir = joinPathFragments(
      offsetFromRoot(projectConfig.root),
      'coverage',
      projectConfig.root
    );
  }

  let changes = [];

  if (!reporters && testObject) {
    changes.push({
      type: ChangeType.Insert,
      index: testObject.getStart() + `test: {`.length + 1,
      text: `reporters: ['default'],`,
    });
  }

  if (testCoverageDir) {
    // Do nothing
  } else if (testCoverage) {
    // has test.coverage, has no reportsDirectory
    // so add reportsDirectory
    changes.push({
      type: ChangeType.Insert,
      index: testCoverage.getStart() + `coverage: {`.length + 1,
      text: `reportsDirectory: '${coverageDir}',`,
    });
    if (!provider) {
      changes.push({
        type: ChangeType.Insert,
        index: testCoverage.getStart() + `coverage: {`.length + 1,
        text: `provider: 'v8',`,
      });
    }
  } else if (testObject) {
    changes.push({
      type: ChangeType.Insert,
      index: testObject.getStart() + `test: {`.length + 1,
      text: `coverage: {
          reportsDirectory: '${coverageDir}',
          provider: 'v8',
        },`,
    });
  }

  if (changes.length > 0) {
    return applyChangesToString(configContents, changes);
  } else {
    return configContents;
  }
}
