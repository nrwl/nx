import * as cp from 'child_process';
import { checkGitVersion, deduceDefaultBase } from './default-base';

describe('deduceDefaultBase', () => {
  const execSyncSpy = jest.spyOn(cp, 'execSync');

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should work when not set', () => {
    execSyncSpy.mockReturnValue(Buffer.from(''));
    const result = deduceDefaultBase();
    expect(result).toEqual('main');
  });

  it('should work when set', () => {
    execSyncSpy.mockReturnValue(Buffer.from('some-other-default-branch'));
    const result = deduceDefaultBase();
    expect(result).toEqual('some-other-default-branch');
  });

  it('should work with extra line terminators', () => {
    execSyncSpy.mockReturnValue(
      Buffer.from(`some-other-default-branch
    `)
    );
    const result = deduceDefaultBase();
    expect(result).toEqual('some-other-default-branch');
  });
});

describe('checkGitVersion', () => {
  const execSyncSpy = jest.spyOn(cp, 'execSync');

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should work with text before semver', () => {
    execSyncSpy.mockReturnValue(Buffer.from(`git version 2.33.0`));
    const result = checkGitVersion();
    expect(result).toEqual('2.33.0');
  });

  it('should work with 4 digit versions', () => {
    execSyncSpy.mockReturnValue(Buffer.from(`git version 2.33.0.5`));
    const result = checkGitVersion();
    expect(result).toEqual('2.33.0');
  });

  it('should work with msysgit versions', () => {
    execSyncSpy.mockReturnValue(Buffer.from(`git version 1.8.3.msysgit.0`));
    const result = checkGitVersion();
    expect(result).toEqual('1.8.3');
  });
});
