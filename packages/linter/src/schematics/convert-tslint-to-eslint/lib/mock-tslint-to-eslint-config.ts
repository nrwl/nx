import {
  exampleE2eProjectTslintJson,
  exampleAngularProjectTslintJson,
  exampleRootTslintJson,
  exampleNonAngularProjectTslintJson,
} from './example-tslint-configs';

/**
 * The actual `findReportedConfiguration()` function is used to execute
 * `tslint --print-config` in a child process and read from the real
 * file system. This won't work for us in tests where we are dealing
 * with a Tree, so we mock out the responses from `findReportedConfiguration()`
 * with previously captured result data from that same command.
 */

export function mockFindReportedConfiguration(_, pathToTSLintJson) {
  if (
    pathToTSLintJson === 'tslint.json' ||
    pathToTSLintJson === '/tslint.json'
  ) {
    return exampleRootTslintJson.tslintPrintConfigResult;
  }

  if (
    pathToTSLintJson === 'apps/app1/tslint.json' ||
    pathToTSLintJson === 'libs/lib1/tslint.json'
  ) {
    return exampleAngularProjectTslintJson.tslintPrintConfigResult;
  }

  if (pathToTSLintJson === 'apps/app1-e2e/tslint.json') {
    return exampleE2eProjectTslintJson.tslintPrintConfigResult;
  }

  if (pathToTSLintJson === 'apps/app2/tslint.json') {
    return exampleNonAngularProjectTslintJson.tslintPrintConfigResult;
  }

  throw new Error(
    `${pathToTSLintJson} is not a part of the supported mock data for these tests`
  );
}
