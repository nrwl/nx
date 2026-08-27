import { resolveLintOptions } from './options';

describe('resolveLintOptions', () => {
  it('should forward target options as Oxlint flags', () => {
    expect(
      resolveLintOptions({ typeAware: true, config: 'a.json', quiet: false })
    ).toMatchObject({ flags: ['--type-aware', '--config=a.json'] });
  });

  it('should forward CLI overrides verbatim and not duplicate their parsed form', () => {
    const resolved = resolveLintOptions({
      typeAware: true,
      __unparsed__: ['--type-aware', '--threads', '2'],
    });
    expect(resolved.flags).toEqual(['--type-aware', '--threads', '2']);
  });

  it('should append args after target options and before CLI overrides', () => {
    expect(
      resolveLintOptions({
        fix: true,
        args: ['--a'],
        __unparsed__: ['--b'],
      }).flags
    ).toEqual(['--fix', '--a', '--b']);
    expect(resolveLintOptions({ args: '--a --b' }).flags).toEqual([
      '--a',
      '--b',
    ]);
  });

  it('should read warning thresholds and still forward them', () => {
    expect(
      resolveLintOptions({ maxWarnings: 3, denyWarnings: true })
    ).toMatchObject({
      maxWarnings: 3,
      denyWarnings: true,
      flags: ['--max-warnings=3', '--deny-warnings'],
    });
    expect(
      resolveLintOptions({ __unparsed__: ['--max-warnings', '0'] })
    ).toMatchObject({ maxWarnings: 0, flags: ['--max-warnings=0'] });
  });

  it("should drop Nx's own --verbose", () => {
    expect(
      resolveLintOptions({
        verbose: true,
        __unparsed__: ['--verbose', '--fix'],
      }).flags
    ).toEqual(['--fix']);
  });

  it('should keep --silent and --format for itself', () => {
    expect(
      resolveLintOptions({ __unparsed__: ['--silent', '--format=github'] })
    ).toMatchObject({ silent: true, format: 'github', flags: [] });
    expect(resolveLintOptions({ args: ['-f', 'json'] })).toMatchObject({
      format: 'json',
      flags: [],
    });
    expect(resolveLintOptions({ format: 'agent' })).toMatchObject({
      format: 'agent',
    });
  });

  it('should reject formats it cannot render', () => {
    expect(() => resolveLintOptions({ args: ['--format=sarif'] })).toThrow(
      /Unsupported Oxlint output format "sarif"/
    );
  });
});
