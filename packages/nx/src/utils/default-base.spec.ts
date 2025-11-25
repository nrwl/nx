// Define mock FIRST - BEFORE any imports
const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: mockExecSync,
}));

// NOW import - mocks are already in place
import { execSync } from 'child_process';
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
