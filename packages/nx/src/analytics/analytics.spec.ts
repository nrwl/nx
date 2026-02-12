import { argsToQueryString } from './analytics';

describe('argsToQueryString', () => {
  it('should convert simple non-sensitive args to query string', () => {
    const result = argsToQueryString({ verbose: true, parallel: 3 });
    expect(result).toBe('verbose=true&parallel=3');
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

  it('should handle numeric values for non-sensitive keys', () => {
    const result = argsToQueryString({ port: 4200 });
    expect(result).toBe('port=4200');
  });

  it('should handle false boolean values', () => {
    const result = argsToQueryString({ verbose: false });
    expect(result).toBe('verbose=false');
  });

  describe('sensitive args sanitization', () => {
    it('should redact sensitive file paths', () => {
      const result = argsToQueryString({ file: '/path/to/file.json' });
      expect(result).toBe('file=%3Credacted%3E');
    });

    it('should redact sensitive project identifiers', () => {
      const result = argsToQueryString({
        project: 'my-secret-app',
        focus: 'internal-lib',
      });
      expect(result).toBe('project=%3Credacted%3E&focus=%3Credacted%3E');
    });

    it('should preserve boolean values on sensitive keys', () => {
      const result = argsToQueryString({ runMigrations: true });
      expect(result).toBe('runMigrations=true');
    });

    it('should preserve false boolean values on sensitive keys', () => {
      const result = argsToQueryString({ graph: false });
      expect(result).toBe('graph=false');
    });

    it('should redact non-boolean values on sensitive keys', () => {
      const result = argsToQueryString({
        runMigrations: 'migrations.json',
      });
      expect(result).toBe('runMigrations=%3Credacted%3E');
    });

    it('should pass through non-sensitive keys unchanged', () => {
      const result = argsToQueryString({
        verbose: true,
        port: 4200,
        parallel: 3,
      });
      expect(result).toBe('verbose=true&port=4200&parallel=3');
    });

    it('should redact each element of array values for sensitive keys', () => {
      const result = argsToQueryString({
        projects: ['secret-app', 'internal-lib'],
      });
      expect(result).toBe('projects=%3Credacted%3E&projects=%3Credacted%3E');
    });

    it('should preserve each element of array values for non-sensitive keys', () => {
      const result = argsToQueryString({
        targets: ['build', 'test'],
      });
      expect(result).toBe('targets=build&targets=test');
    });

    it('should catch kebab-case sensitive keys', () => {
      const result = argsToQueryString({ 'output-path': 'dist/app' });
      expect(result).toBe('output-path=%3Credacted%3E');
    });

    it('should handle a real-world graph command scenario', () => {
      const result = argsToQueryString({
        file: 'output.json',
        focus: 'my-secret-app',
        exclude: 'internal-lib',
        host: '192.168.1.1',
        port: 4200,
        targets: 'build',
        watch: true,
      });
      expect(result).toBe(
        'file=%3Credacted%3E&focus=%3Credacted%3E&exclude=%3Credacted%3E&host=%3Credacted%3E&port=4200&targets=build&watch=true'
      );
    });

    it('should always redact credentials', () => {
      const result = argsToQueryString({ otp: '123456' });
      expect(result).toBe('otp=%3Credacted%3E');
    });

    it('should redact git refs', () => {
      const result = argsToQueryString({
        base: 'feature/secret-branch',
        head: 'main',
      });
      expect(result).toBe('base=%3Credacted%3E&head=%3Credacted%3E');
    });

    it('should redact URLs and hosts', () => {
      const result = argsToQueryString({
        baseUrl: 'https://internal.company.com',
        deployUrl: 'https://staging.company.com/app',
      });
      expect(result).toBe('baseUrl=%3Credacted%3E&deployUrl=%3Credacted%3E');
    });

    it('should handle kebab-case config keys', () => {
      const result = argsToQueryString({
        'ts-config': 'tsconfig.app.json',
        'webpack-config': 'webpack.config.js',
      });
      expect(result).toBe(
        'ts-config=%3Credacted%3E&webpack-config=%3Credacted%3E'
      );
    });
  });
});
