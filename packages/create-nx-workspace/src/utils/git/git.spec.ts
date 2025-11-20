import { checkGitVersion } from './git';
import * as childProcessUtils from '../child-process-utils';

describe('checkGitVersion', () => {
  const execAndWaitSpy = jest.spyOn(childProcessUtils, 'execAndWait');

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should work with text before semver', async () => {
    execAndWaitSpy.mockResolvedValue({ code: 0, stdout: 'git version 2.33.0' });
    const result = await checkGitVersion();
    expect(result).toEqual('2.33.0');
  });

  it('should work with 4 digit versions', async () => {
    execAndWaitSpy.mockResolvedValue({
      code: 0,
      stdout: 'git version 2.33.0.5',
    });
    const result = await checkGitVersion();
    expect(result).toEqual('2.33.0');
  });

  it('should work with msysgit versions', async () => {
    execAndWaitSpy.mockResolvedValue({
      code: 0,
      stdout: 'git version 1.8.3.msysgit.0',
    });
    const result = await checkGitVersion();
    expect(result).toEqual('1.8.3');
  });
});
