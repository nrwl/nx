import { enableCompileCache } from './compile-cache';

describe('enableCompileCache', () => {
  const originalFlag = process.env.NX_COMPILE_CACHE;

  beforeEach(() => {
    delete process.env.NX_COMPILE_CACHE;
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.NX_COMPILE_CACHE;
    } else {
      process.env.NX_COMPILE_CACHE = originalFlag;
    }
  });

  it('returns false when NX_COMPILE_CACHE=false and does not call enableImpl', () => {
    process.env.NX_COMPILE_CACHE = 'false';
    const enableImpl = jest.fn();
    expect(enableCompileCache(enableImpl)).toBe(false);
    expect(enableImpl).not.toHaveBeenCalled();
  });

  it('returns false when enableImpl is not a function (pre-22.8 Node)', () => {
    expect(enableCompileCache(undefined)).toBe(false);
  });

  it('calls enableImpl with no arguments and returns true', () => {
    const enableImpl = jest.fn();
    expect(enableCompileCache(enableImpl)).toBe(true);
    expect(enableImpl).toHaveBeenCalledTimes(1);
    expect(enableImpl).toHaveBeenCalledWith();
  });

  it('returns false when enableImpl throws', () => {
    const enableImpl = jest.fn(() => {
      throw new Error('boom');
    });
    expect(enableCompileCache(enableImpl)).toBe(false);
  });
});
