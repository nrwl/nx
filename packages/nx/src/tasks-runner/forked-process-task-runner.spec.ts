import { ForkedProcessTaskRunner } from './forked-process-task-runner';

describe('ForkedProcessTaskRunner.shouldLoadDotenvFiles', () => {
  it('should return true if process.env.NX_LOAD_DOT_ENV_FILES is "true"', function () {
    process.env.NX_LOAD_DOT_ENV_FILES = 'true';
    expect(ForkedProcessTaskRunner.shouldLoadDotenvFiles()).toBe(true);
  });

  it('should return false if process.env.NX_LOAD_DOT_ENV_FILES is not "true"', function () {
    delete process.env.NX_LOAD_DOT_ENV_FILES;
    expect(ForkedProcessTaskRunner.shouldLoadDotenvFiles()).toBe(false);
    process.env.NX_LOAD_DOT_ENV_FILES = 'false';
    expect(ForkedProcessTaskRunner.shouldLoadDotenvFiles()).toBe(false);
    process.env.NX_LOAD_DOT_ENV_FILES = 'something else';
    expect(ForkedProcessTaskRunner.shouldLoadDotenvFiles()).toBe(false);
  });
});
