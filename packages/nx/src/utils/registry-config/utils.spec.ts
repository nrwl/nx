import {
  expandEnvVars,
  expandPnpmEnvVars,
  getPackageScope,
  nerfDart,
  readEnvVar,
} from './utils';

describe('getPackageScope', () => {
  it.each([
    ['@types/node', '@types'],
    ['@nx/devkit', '@nx'],
    ['is-even', null],
    ['@malformed', null],
  ])('%s -> %s', (pkg, scope) => {
    expect(getPackageScope(pkg)).toEqual(scope);
  });
});

describe('nerfDart', () => {
  it.each([
    ['https://registry.npmjs.org/', '//registry.npmjs.org/'],
    ['https://r.example.com/npm/', '//r.example.com/npm/'],
    // Without a trailing slash the last segment is dropped (npm semantics).
    ['https://r.example.com/npm', '//r.example.com/'],
    ['https://r.example.com:8443/a/b/', '//r.example.com:8443/a/b/'],
    ['not a url', null],
  ])('%s -> %s', (url, dart) => {
    expect(nerfDart(url)).toEqual(dart);
  });
});

describe('expandEnvVars', () => {
  it('expands a ${VAR} reference from the provided env', () => {
    expect(expandEnvVars('${TOKEN}', { TOKEN: 'secret' })).toBe('secret');
  });

  it('expands a ${VAR} embedded in a larger string', () => {
    expect(
      expandEnvVars('https://${HOST}/npm/', { HOST: 'reg.example.com' })
    ).toBe('https://reg.example.com/npm/');
  });

  it('leaves an unknown ${VAR} verbatim', () => {
    expect(expandEnvVars('${MISSING}', {})).toBe('${MISSING}');
  });

  it('does not expand a bare $VAR (braces are required)', () => {
    expect(expandEnvVars('$TOKEN', { TOKEN: 'secret' })).toBe('$TOKEN');
  });

  it('does not honor a ${VAR:-default} fallback (npm has no default operator)', () => {
    // npm's ${VAR} substitution has no `:-default` form, so the whole token is
    // one unknown var name and stays verbatim (unlike berry's nested defaults).
    expect(expandEnvVars('${TOKEN:-fallback}', {})).toBe('${TOKEN:-fallback}');
  });

  it('leaves an escaped \\${VAR} unexpanded', () => {
    // npm applies the same escape rule to the values we hand it, so the
    // backslashes stay and npm consumes them.
    expect(expandEnvVars('\\${TOKEN}', { TOKEN: 'secret' })).toBe('\\${TOKEN}');
  });

  it('expands after an escaped backslash and consumes half the run', () => {
    expect(expandEnvVars('\\\\${TOKEN}', { TOKEN: 'secret' })).toBe('\\secret');
  });

  it('stops a name at a nested ${ rather than spanning it', () => {
    // Verified against npm's and pnpm's own env-replace: the outer `${A` never
    // forms a reference, and the inner one expands in place.
    expect(expandEnvVars('${A${B}', { B: 'x' })).toBe('${Ax');
  });
});

describe('expandPnpmEnvVars', () => {
  it('expands a plain ${VAR} reference', () => {
    expect(expandPnpmEnvVars('${TOKEN}', { TOKEN: 'secret' })).toBe('secret');
  });

  it('honors a ${VAR-default} fallback when the variable is unset', () => {
    expect(expandPnpmEnvVars('${TOKEN-fallback}', {})).toBe('fallback');
  });

  it('keeps a set value over a ${VAR-default} fallback', () => {
    expect(expandPnpmEnvVars('${TOKEN-fallback}', { TOKEN: 'secret' })).toBe(
      'secret'
    );
  });

  it('keeps an empty value for ${VAR-default} but not for ${VAR:-default}', () => {
    // Only the colon form treats an empty value as absent.
    expect(expandPnpmEnvVars('${TOKEN-fallback}', { TOKEN: '' })).toBe('');
    expect(expandPnpmEnvVars('${TOKEN:-fallback}', { TOKEN: '' })).toBe(
      'fallback'
    );
  });

  it('leaves an unresolvable reference verbatim instead of throwing', () => {
    // pnpm aborts here; nx is only building an env overlay.
    expect(expandPnpmEnvVars('${MISSING}', {})).toBe('${MISSING}');
  });

  it('leaves an escaped \\${VAR} unexpanded', () => {
    expect(expandPnpmEnvVars('\\${TOKEN}', { TOKEN: 'secret' })).toBe(
      '\\${TOKEN}'
    );
  });
});

describe('readEnvVar', () => {
  it('reads an exact-case match', () => {
    expect(
      readEnvVar({ npm_config_registry: 'x' }, 'npm_config_registry')
    ).toBe('x');
  });

  it('falls back to the lowercased name', () => {
    expect(
      readEnvVar({ npm_config_registry: 'x' }, 'NPM_CONFIG_REGISTRY')
    ).toBe('x');
  });

  it('falls back to the uppercased name', () => {
    expect(
      readEnvVar({ NPM_CONFIG_REGISTRY: 'x' }, 'npm_config_registry')
    ).toBe('x');
  });

  it('returns undefined when no case variant is set', () => {
    expect(readEnvVar({}, 'npm_config_registry')).toBeUndefined();
  });
});
