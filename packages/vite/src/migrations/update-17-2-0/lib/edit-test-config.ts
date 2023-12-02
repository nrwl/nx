import {
  ChangeType,
  ProjectConfiguration,
  applyChangesToString,
  joinPathFragments,
  offsetFromRoot,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import ts = require('typescript');

export function updateTestConfig(
  configContents: string,
  projectConfig: ProjectConfiguration
): string {
  const testObject = tsquery.query(
    configContents,
    `PropertyAssignment:has(Identifier[name="test"])`
  )?.[0];
  let testCoverageDir: ts.Node;
  let testCoverage: ts.Node;
  let provider: ts.Node;
  if (testObject) {
    testCoverage = tsquery.query(
      testObject,
      `PropertyAssignment:has(Identifier[name="coverage"])`
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

  if (testCoverageDir) {
    // Do nothing
  } else if (testCoverage) {
    // has test.coverage, has no reportsDirectory
    // so add reportsDirectory
    configContents = applyChangesToString(configContents, [
      {
        type: ChangeType.Insert,
        index: testCoverage.getStart() + `coverage: {`.length + 1,
        text: `reportsDirectory: '${coverageDir}',`,
      },
    ]);
    if (!provider) {
      configContents = applyChangesToString(configContents, [
        {
          type: ChangeType.Insert,
          index: testCoverage.getStart() + `coverage: {`.length + 1,
          text: `provider: 'v8',`,
        },
      ]);
    }
  } else if (testObject) {
    configContents = applyChangesToString(configContents, [
      {
        type: ChangeType.Insert,
        index: testObject.getStart() + `test: {`.length + 1,
        text: `coverage: {
          reportsDirectory: '${coverageDir}',
          provider: 'v8',
        },`,
      },
    ]);
  } else {
    // has no test so do nothing
  }

  return configContents;
}
