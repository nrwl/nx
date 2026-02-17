import { AggregatedResult } from '@jest/reporters';
import { pluralize, formatTime } from 'jest-util';
import { styleText } from 'node:util';

/**
 * Copied from the jest repo because these utility functions are not exposed through the package
 * https://github.com/facebook/jest/blob/7a64ede2163eba4ecc725f448cd92102cd8c14aa/packages/jest-reporters/src/utils.ts
 */

const PROGRESS_BAR_WIDTH = 40;

const getValuesCurrentTestCases = (currentTestCases = []) => {
  let numFailingTests = 0;
  let numPassingTests = 0;
  let numPendingTests = 0;
  let numTodoTests = 0;
  let numTotalTests = 0;
  currentTestCases.forEach((testCase) => {
    switch (testCase.testCaseResult.status) {
      case 'failed': {
        numFailingTests++;
        break;
      }
      case 'passed': {
        numPassingTests++;
        break;
      }
      case 'skipped': {
        numPendingTests++;
        break;
      }
      case 'todo': {
        numTodoTests++;
        break;
      }
    }
    numTotalTests++;
  });

  return {
    numFailingTests,
    numPassingTests,
    numPendingTests,
    numTodoTests,
    numTotalTests,
  };
};

const renderTime = (runTime: number, estimatedTime: number, width: number) => {
  // If we are more than one second over the estimated time, highlight it.
  const renderedTime =
    estimatedTime && runTime >= estimatedTime + 1
      ? styleText('bold', styleText('yellow', formatTime(runTime, 0)))
      : formatTime(runTime, 0);
  let time = styleText('bold', `Time:`) + `        ${renderedTime}`;
  if (runTime < estimatedTime) {
    time += `, estimated ${formatTime(estimatedTime, 0)}`;
  }

  // Only show a progress bar if the test run is actually going to take
  // some time.
  if (estimatedTime > 2 && runTime < estimatedTime && width) {
    const availableWidth = Math.min(PROGRESS_BAR_WIDTH, width);
    const length = Math.min(
      Math.floor((runTime / estimatedTime) * availableWidth),
      availableWidth
    );
    if (availableWidth >= 2) {
      time +=
        '\n' +
        styleText('green', '█').repeat(length) +
        styleText('white', '█').repeat(availableWidth - length);
    }
  }
  return time;
};

export const getSummary = (
  aggregatedResults: AggregatedResult,
  options?: {
    currentTestCases?: any;
    estimatedTime?: number;
    roundTime?: boolean;
    width?: number;
  }
): string => {
  let runTime = (Date.now() - aggregatedResults.startTime) / 1000;
  if (options?.roundTime) {
    runTime = Math.floor(runTime);
  }

  const {
    numFailingTests,
    numPendingTests,
    numTodoTests,
    numPassingTests,
    numTotalTests,
  } = getValuesCurrentTestCases(options?.currentTestCases);

  const estimatedTime = options?.estimatedTime || 0;
  const snapshotResults = aggregatedResults.snapshot;
  const snapshotsAdded = snapshotResults.added;
  const snapshotsFailed = snapshotResults.unmatched;
  const snapshotsOutdated = snapshotResults.unchecked;
  const snapshotsFilesRemoved = snapshotResults.filesRemoved;
  const snapshotsDidUpdate = snapshotResults.didUpdate;
  const snapshotsPassed = snapshotResults.matched;
  const snapshotsTotal = snapshotResults.total;
  const snapshotsUpdated = snapshotResults.updated;
  const suitesFailed = aggregatedResults.numFailedTestSuites;
  const suitesPassed = aggregatedResults.numPassedTestSuites;
  const suitesPending = aggregatedResults.numPendingTestSuites;
  const suitesRun = suitesFailed + suitesPassed;
  const suitesTotal = aggregatedResults.numTotalTestSuites;
  const testsFailed = aggregatedResults.numFailedTests;
  const testsPassed = aggregatedResults.numPassedTests;
  const testsPending = aggregatedResults.numPendingTests;
  const testsTodo = aggregatedResults.numTodoTests;
  const testsTotal = aggregatedResults.numTotalTests;
  const width = options?.width || 0;

  const suites =
    styleText('bold', 'Test Suites: ') +
    (suitesFailed
      ? styleText('bold', styleText('red', `${suitesFailed} failed`)) + ', '
      : '') +
    (suitesPending
      ? styleText('bold', styleText('yellow', `${suitesPending} skipped`)) +
        ', '
      : '') +
    (suitesPassed
      ? styleText('bold', styleText('green', `${suitesPassed} passed`)) + ', '
      : '') +
    (suitesRun !== suitesTotal
      ? suitesRun + ' of ' + suitesTotal
      : suitesTotal) +
    ` total`;

  const updatedTestsFailed = testsFailed + numFailingTests;
  const updatedTestsPending = testsPending + numPendingTests;
  const updatedTestsTodo = testsTodo + numTodoTests;
  const updatedTestsPassed = testsPassed + numPassingTests;
  const updatedTestsTotal = testsTotal + numTotalTests;

  const tests =
    styleText('bold', 'Tests:       ') +
    (updatedTestsFailed > 0
      ? styleText('bold', styleText('red', `${updatedTestsFailed} failed`)) +
        ', '
      : '') +
    (updatedTestsPending > 0
      ? styleText(
          'bold',
          styleText('yellow', `${updatedTestsPending} skipped`)
        ) + ', '
      : '') +
    (updatedTestsTodo > 0
      ? styleText('bold', styleText('magenta', `${updatedTestsTodo} todo`)) +
        ', '
      : '') +
    (updatedTestsPassed > 0
      ? styleText('bold', styleText('green', `${updatedTestsPassed} passed`)) +
        ', '
      : '') +
    `${updatedTestsTotal} total`;

  const snapshots =
    styleText('bold', 'Snapshots:   ') +
    (snapshotsFailed
      ? styleText('bold', styleText('red', `${snapshotsFailed} failed`)) + ', '
      : '') +
    (snapshotsOutdated && !snapshotsDidUpdate
      ? styleText(
          'bold',
          styleText('yellow', `${snapshotsOutdated} obsolete`)
        ) + ', '
      : '') +
    (snapshotsOutdated && snapshotsDidUpdate
      ? styleText('bold', styleText('green', `${snapshotsOutdated} removed`)) +
        ', '
      : '') +
    (snapshotsFilesRemoved && !snapshotsDidUpdate
      ? styleText(
          'bold',
          styleText(
            'yellow',
            pluralize('file', snapshotsFilesRemoved) + ' obsolete'
          )
        ) + ', '
      : '') +
    (snapshotsFilesRemoved && snapshotsDidUpdate
      ? styleText(
          'bold',
          styleText(
            'green',
            pluralize('file', snapshotsFilesRemoved) + ' removed'
          )
        ) + ', '
      : '') +
    (snapshotsUpdated
      ? styleText('bold', styleText('green', `${snapshotsUpdated} updated`)) +
        ', '
      : '') +
    (snapshotsAdded
      ? styleText('bold', styleText('green', `${snapshotsAdded} written`)) +
        ', '
      : '') +
    (snapshotsPassed
      ? styleText('bold', styleText('green', `${snapshotsPassed} passed`)) +
        ', '
      : '') +
    `${snapshotsTotal} total`;

  const time = renderTime(runTime, estimatedTime, width);
  return [suites, tests, snapshots, time].join('\n');
};
