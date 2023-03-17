import { checkGitVersion } from './git';
import * as cp from 'child_process';

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
