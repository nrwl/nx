import { argsToQueryString } from './analytics';

describe('argsToQueryString', () => {
  it('should convert simple args to query string', () => {
    const result = argsToQueryString({ verbose: true, targets: 'build' });
    expect(result).toBe('verbose=true&targets=build');
  });

  it('should handle array values by repeating the key', () => {
    const result = argsToQueryString({
      targets: ['build', 'test'],
    });
    expect(result).toBe('targets=build&targets=test');
  });

  it('should filter out internal yargs keys', () => {
    const result = argsToQueryString({
      verbose: true,
      $0: 'nx',
      _: ['run-many'],
      __overrides_unparsed__: [],
      __overrides__: [],
    });
    expect(result).toBe('verbose=true');
  });

  it('should skip null and undefined values', () => {
    const result = argsToQueryString({
      verbose: true,
      missing: null,
      absent: undefined,
    });
    expect(result).toBe('verbose=true');
  });

  it('should skip nested objects (non-array)', () => {
    const result = argsToQueryString({
      verbose: true,
      nested: { deep: 'value' },
    });
    expect(result).toBe('verbose=true');
  });

  it('should return empty string for empty args', () => {
    const result = argsToQueryString({});
    expect(result).toBe('');
  });

  it('should return empty string when all keys are internal', () => {
    const result = argsToQueryString({
      $0: 'nx',
      _: [],
    });
    expect(result).toBe('');
  });

  it('should handle numeric values', () => {
    const result = argsToQueryString({ port: 4200 });
    expect(result).toBe('port=4200');
  });

  it('should handle false boolean values', () => {
    const result = argsToQueryString({ verbose: false });
    expect(result).toBe('verbose=false');
  });
});
