// Mock the child_process module - must be before imports
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: mockExecSync,
}));

import { deduceDefaultBase } from './default-base';

describe('deduceDefaultBase', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it('should work when not set', () => {
    mockExecSync.mockReturnValue(Buffer.from(''));
    const result = deduceDefaultBase();
    expect(result).toEqual('main');
  });

  it('should work when set', () => {
    mockExecSync.mockReturnValue(Buffer.from('some-other-default-branch'));
    const result = deduceDefaultBase();
    expect(result).toEqual('some-other-default-branch');
  });

  it('should work with extra line terminators', () => {
    mockExecSync.mockReturnValue(
      Buffer.from(`some-other-default-branch
    `)
    );
    const result = deduceDefaultBase();
    expect(result).toEqual('some-other-default-branch');
  });
});
