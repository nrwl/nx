import { expandEnvVars, getPackageScope, nerfDart, readEnvVar } from './utils';

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
