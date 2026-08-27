import { execGradleAsync } from '../../utils/exec-gradle';
import {
  getGraphTimeoutMs,
  getNxProjectGraphLines,
} from './get-project-graph-lines';

jest.mock('../../utils/exec-gradle', () => ({
  ...jest.requireActual('../../utils/exec-gradle'),
  execGradleAsync: jest.fn(),
}));

const lockTimeoutOutput = Buffer.from(
  'FAILURE: Build failed with an exception.\n' +
    '* What went wrong:\n' +
    'Timeout waiting to lock build logic queue. It is currently in use by another Gradle instance.'
);

describe('getNxProjectGraphLines', () => {
  const execGradleAsyncMock = execGradleAsync as jest.Mock;

  beforeEach(() => {
    execGradleAsyncMock.mockReset();
    delete process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT;
  });

  afterEach(() => {
    delete process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT;
  });

  it('should retry when gradle times out waiting for a lock', async () => {
    execGradleAsyncMock
      .mockRejectedValueOnce(lockTimeoutOutput)
      .mockResolvedValueOnce(Buffer.from('line1\nline2\n'));

    await expect(
      getNxProjectGraphLines('/proj/gradlew', 'hash', {})
    ).resolves.toEqual(['line1', 'line2']);
    expect(execGradleAsyncMock).toHaveBeenCalledTimes(2);
  });

  it('should give up after the retry budget is exhausted', async () => {
    execGradleAsyncMock.mockRejectedValue(lockTimeoutOutput);

    await expect(
      getNxProjectGraphLines('/proj/gradlew', 'hash', {})
    ).rejects.toMatchObject({
      errors: [
        [
          '/proj/gradlew',
          expect.objectContaining({
            message: expect.stringMatching(
              /another Gradle build is holding a lock/
            ),
          }),
        ],
      ],
    });
    expect(execGradleAsyncMock).toHaveBeenCalledTimes(3);
  });

  // Regression: retries used to run under the graph timeout without checking it,
  // so the timeout aborted mid-retry and its generic message replaced the lock
  // guidance on the default local budget.
  it('should not retry when another lock wait would outlast the graph timeout', async () => {
    // Budget must satisfy rejectMs < budget <= 2 * rejectMs: below the budget so
    // the attempt loses the lock before the abort fires, at or under twice it so
    // the guard refuses a second attempt. Kept well clear of both bounds — a
    // narrower margin flips to the timeout message on a loaded machine.
    process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT = '0.5';
    execGradleAsyncMock.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(lockTimeoutOutput), 300)
        )
    );

    await expect(
      getNxProjectGraphLines('/proj/gradlew', 'hash', {})
    ).rejects.toMatchObject({
      errors: [
        [
          '/proj/gradlew',
          expect.objectContaining({
            message: expect.stringMatching(
              /another Gradle build is holding a lock/
            ),
          }),
        ],
      ],
    });
    expect(execGradleAsyncMock).toHaveBeenCalledTimes(1);
  });

  // setTimeout clamps a delay past the 32-bit signed max to 1ms, so an
  // unclamped huge value would abort the build instantly — the opposite of
  // what the timeout error tells the user to do.
  it('should clamp an overflowing NX_GRADLE_PROJECT_GRAPH_TIMEOUT', () => {
    process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT = '9999999';
    expect(getGraphTimeoutMs()).toBe(2 ** 31 - 1);

    process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT = 'Infinity';
    expect(getGraphTimeoutMs()).toBe(2 ** 31 - 1);

    process.env.NX_GRADLE_PROJECT_GRAPH_TIMEOUT = '30';
    expect(getGraphTimeoutMs()).toBe(30_000);
  });

  it('should not retry other gradle failures', async () => {
    execGradleAsyncMock.mockRejectedValue(
      Buffer.from("Task 'nxProjectGraph' not found in root project")
    );

    await expect(
      getNxProjectGraphLines('/proj/gradlew', 'hash', {})
    ).rejects.toMatchObject({
      errors: [
        [
          expect.any(String),
          expect.objectContaining({
            message: expect.stringMatching(/nx generate @nx\/gradle:init/),
          }),
        ],
      ],
    });
    expect(execGradleAsyncMock).toHaveBeenCalledTimes(1);
  });
});
