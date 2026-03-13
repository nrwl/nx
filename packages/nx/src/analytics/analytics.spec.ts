import { argsToQueryString } from './analytics';

describe('argsToQueryString', () => {
  it('should include boolean args', () => {
    const result = argsToQueryString({ verbose: true, skipNxCache: false });
    expect(result).toBe('verbose=true&skipNxCache=false');
  });

  it('should include number args', () => {
    const result = argsToQueryString({ parallel: 3, port: 4200 });
    expect(result).toBe('parallel=3&port=4200');
  });

  it('should include allowed string args', () => {
    const result = argsToQueryString({ outputStyle: 'dynamic', type: 'app' });
    expect(result).toBe('outputStyle=dynamic&type=app');
  });

  it('should drop unknown string args', () => {
    const result = argsToQueryString({
      verbose: true,
      project: 'my-secret-app',
      file: '/path/to/file.json',
    });
    expect(result).toBe('verbose=true');
  });

  it('should drop array args', () => {
    const result = argsToQueryString({
      verbose: true,
      targets: ['build', 'test'],
      projects: ['app1', 'app2'],
    });
    expect(result).toBe('verbose=true');
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

  it('should return empty string for empty args', () => {
    const result = argsToQueryString({});
    expect(result).toBe('');
  });

  it('should handle a real-world run-many scenario', () => {
    const result = argsToQueryString({
      targets: ['build', 'test'],
      projects: ['cart', 'checkout'],
      parallel: 3,
      verbose: false,
      skipNxCache: false,
      nxBail: true,
      outputStyle: 'stream',
      $0: 'nx',
      _: ['run-many'],
    });
    expect(result).toBe(
      'parallel=3&verbose=false&skipNxCache=false&nxBail=true&outputStyle=stream'
    );
  });

  it('should drop sensitive data like paths, URLs, git refs', () => {
    const result = argsToQueryString({
      file: 'output.json',
      focus: 'my-secret-app',
      host: '192.168.1.1',
      base: 'feature/secret-branch',
      head: 'main',
      baseUrl: 'https://internal.company.com',
      port: 4200,
      watch: true,
    });
    // Only boolean and number values pass through
    expect(result).toBe('port=4200&watch=true');
  });

  it('should drop nested objects', () => {
    const result = argsToQueryString({
      verbose: true,
      nested: { deep: 'value' },
    });
    expect(result).toBe('verbose=true');
  });
});
