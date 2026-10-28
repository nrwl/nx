// child_process's ESM namespace is frozen; spy mode wraps the real exports so
// they can be overridden per test.
vi.mock('child_process', { spy: true });
import * as cp from 'child_process';
import { deduceDefaultBase } from './default-base';

describe('deduceDefaultBase', () => {
  const execSyncSpy = vi.spyOn(cp, 'execSync');

  afterEach(() => {
    vi.resetAllMocks();
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
