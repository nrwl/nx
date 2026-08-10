import {
  bridgePnpmEnvVars,
  expandEnvVars,
  expandNpmEnvVars,
  expandPnpmEnvVars,
  getPackageScope,
  ignoresNpmConfigEnv,
  mergeNpmConfigEnv,
  nerfDart,
  pnpmEnvVarsResolve,
  readEnvVar,
  readNpmConfigEnv,
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
    expect(expandEnvVars('${TOKEN:-fallback}', {})).toBe('${TOKEN:-fallback}');
  });

  it('leaves an escaped \\${VAR} unexpanded', () => {
    expect(expandEnvVars('\\${TOKEN}', { TOKEN: 'secret' })).toBe('\\${TOKEN}');
  });

  it('expands after an escaped backslash and consumes half the run', () => {
    expect(expandEnvVars('\\\\${TOKEN}', { TOKEN: 'secret' })).toBe('\\secret');
  });

  it('stops a name at a nested ${ rather than spanning it', () => {
    // Verified against npm's and pnpm's own env-replace.
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
    expect(expandPnpmEnvVars('${TOKEN-fallback}', { TOKEN: '' })).toBe('');
    expect(expandPnpmEnvVars('${TOKEN:-fallback}', { TOKEN: '' })).toBe(
      'fallback'
    );
  });

  it('drops an unresolvable reference instead of keeping it verbatim', () => {
    expect(expandPnpmEnvVars('${MISSING}', {})).toBe('');
    expect(expandPnpmEnvVars('pre-${MISSING}-post', {})).toBe('pre--post');
  });

  it('consumes the escape on \\${VAR} and keeps the reference literal', () => {
    // pnpm's own replaceWith returns orig.slice((escape.length + 1) / 2), so the
    // key it looks a setting up under carries no backslash.
    expect(expandPnpmEnvVars('\\${TOKEN}', { TOKEN: 'secret' })).toBe(
      '${TOKEN}'
    );
    expect(expandPnpmEnvVars('\\\\\\${TOKEN}', { TOKEN: 'secret' })).toBe(
      '\\${TOKEN}'
    );
  });
});

describe('bridgePnpmEnvVars', () => {
  it('escapes what a reference resolved to, so npm reproduces it', () => {
    expect(
      bridgePnpmEnvVars('${TOKEN}', { TOKEN: 'ab${INNER}cd', INNER: 'leaked' })
    ).toBe('ab\\${INNER}cd');
  });

  it("leaves an escaped reference for npm's own pass to consume", () => {
    expect(bridgePnpmEnvVars('\\${TOKEN}', { TOKEN: 'secret' })).toBe(
      '\\${TOKEN}'
    );
  });

  it('hands npm the text its expansion turns back into what pnpm resolved', () => {
    const env = { A: 'a-value', B: 'b${A}b', C: '' };
    const atoms = ['', 'p', '${A}', '${B}', '${C}', '${MISSING}', '\\${A}'];
    for (const left of atoms) {
      for (const right of atoms) {
        const input = `${left}${right}`;
        expect(expandNpmEnvVars(bridgePnpmEnvVars(input, env), env)).toBe(
          expandPnpmEnvVars(input, env)
        );
      }
    }
  });
});

describe('pnpmEnvVarsResolve', () => {
  it('answers true for a value with nothing to resolve', () => {
    expect(pnpmEnvVarsResolve('plain', {})).toBe(true);
  });

  it('answers false only for a reference pnpm finds nothing for', () => {
    expect(pnpmEnvVarsResolve('${TOKEN}', { TOKEN: 'secret' })).toBe(true);
    expect(pnpmEnvVarsResolve('${TOKEN}', {})).toBe(false);
    // A fallback resolves, an empty value included.
    expect(pnpmEnvVarsResolve('${TOKEN-fallback}', {})).toBe(true);
    expect(pnpmEnvVarsResolve('${TOKEN}', { TOKEN: '' })).toBe(true);
  });

  it('answers false when any one of several references fails', () => {
    expect(pnpmEnvVarsResolve('${A}-${B}', { A: 'a', B: 'b' })).toBe(true);
    expect(pnpmEnvVarsResolve('${A}-${B}', { A: 'a' })).toBe(false);
  });

  it('ignores an escaped \\${VAR}, which pnpm never resolves either', () => {
    expect(pnpmEnvVarsResolve('\\${TOKEN}', {})).toBe(true);
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

describe('readNpmConfigEnv', () => {
  it('reads any casing of the npm_config_ prefix', () => {
    expect(
      readNpmConfigEnv(
        { Npm_Config_Registry: 'https://a.example.com/' },
        'registry'
      )
    ).toBe('https://a.example.com/');
  });

  it('takes the last spelling, as npm does', () => {
    expect(
      readNpmConfigEnv(
        {
          npm_config_registry: 'https://a.example.com/',
          NPM_CONFIG_REGISTRY: 'https://b.example.com/',
        },
        'registry'
      )
    ).toBe('https://b.example.com/');
  });

  it('skips an empty value rather than letting it win', () => {
    expect(
      readNpmConfigEnv(
        {
          npm_config_registry: 'https://a.example.com/',
          NPM_CONFIG_REGISTRY: '',
        },
        'registry'
      )
    ).toBe('https://a.example.com/');
  });

  it('finds nothing for a scope npm rewrites on the way in', () => {
    expect(
      readNpmConfigEnv(
        { 'npm_config_@my_scope:registry': 'https://a.example.com/' },
        '@my_scope:registry'
      )
    ).toBeUndefined();
  });
});

describe('expandNpmEnvVars', () => {
  it('expands a resolvable reference', () => {
    expect(
      expandNpmEnvVars('https://${HOST}/', { HOST: 'a.example.com' })
    ).toBe('https://a.example.com/');
  });

  it('leaves an unresolvable reference verbatim', () => {
    expect(expandNpmEnvVars('${MISSING}', {})).toBe('${MISSING}');
  });

  it('resolves the ${VAR?} form to an empty string when unset', () => {
    expect(expandNpmEnvVars('${MISSING?}', {})).toBe('');
  });

  it('consumes the escape npm consumes', () => {
    expect(expandNpmEnvVars('\\${HOST}', { HOST: 'a.example.com' })).toBe(
      '${HOST}'
    );
    expect(expandNpmEnvVars('\\\\${HOST}', { HOST: 'a.example.com' })).toBe(
      '\\a.example.com'
    );
  });
});

describe('mergeNpmConfigEnv', () => {
  it('drops an ambient key npm resolves to an overlaid setting', () => {
    expect(
      mergeNpmConfigEnv(
        {
          NPM_CONFIG_REGISTRY: 'https://ambient.example.com/',
          PATH: '/usr/bin',
        },
        { npm_config_registry: 'https://overlay.example.com/' }
      )
    ).toEqual({
      PATH: '/usr/bin',
      npm_config_registry: 'https://overlay.example.com/',
    });
  });

  it('drops a twin spelled with the other separator', () => {
    expect(
      mergeNpmConfigEnv(
        { 'npm_config_strict-ssl': 'false' },
        { npm_config_strict_ssl: 'true' }
      )
    ).toEqual({ npm_config_strict_ssl: 'true' });
  });

  it('drops a nerf-darted twin (npm slices the prefix positionally)', () => {
    expect(
      mergeNpmConfigEnv(
        { 'NPM_CONFIG_//reg.example.com/:_authToken': 'ambient-token' },
        { 'npm_config_//reg.example.com/:_authToken': 'overlay-token' }
      )
    ).toEqual({ 'npm_config_//reg.example.com/:_authToken': 'overlay-token' });
  });

  it('keeps a nerf-darted key for another host (npm never case-folds a dart)', () => {
    expect(
      mergeNpmConfigEnv(
        { 'npm_config_//REG.example.com/:_authToken': 'ambient-token' },
        { 'npm_config_//reg.example.com/:_authToken': 'overlay-token' }
      )
    ).toEqual({
      'npm_config_//REG.example.com/:_authToken': 'ambient-token',
      'npm_config_//reg.example.com/:_authToken': 'overlay-token',
    });
  });

  it('keeps an npm setting the overlay does not carry', () => {
    expect(
      mergeNpmConfigEnv(
        { NPM_CONFIG_CAFILE: '/ca.pem' },
        { npm_config_registry: 'https://overlay.example.com/' }
      )
    ).toEqual({
      NPM_CONFIG_CAFILE: '/ca.pem',
      npm_config_registry: 'https://overlay.example.com/',
    });
  });

  it('keeps only the last ambient spelling of a setting it does not carry', () => {
    expect(
      mergeNpmConfigEnv(
        {
          npm_config_cafile: '/first.pem',
          NPM_CONFIG_CAFILE: '/last.pem',
        },
        {}
      )
    ).toEqual({ NPM_CONFIG_CAFILE: '/last.pem' });
  });

  it('lets an empty ambient value neither win nor displace', () => {
    expect(
      mergeNpmConfigEnv(
        { npm_config_cafile: '/ca.pem', NPM_CONFIG_CAFILE: '' },
        {}
      )
    ).toEqual({ npm_config_cafile: '/ca.pem', NPM_CONFIG_CAFILE: '' });
  });

  it('drops an ambient setting the package manager never reads', () => {
    expect(
      mergeNpmConfigEnv(
        { NPM_CONFIG_CAFILE: '/ca.pem', PATH: '/usr/bin' },
        { npm_config_registry: 'https://overlay.example.com/' },
        () => true
      )
    ).toEqual({
      PATH: '/usr/bin',
      npm_config_registry: 'https://overlay.example.com/',
    });
  });

  it('drops an ambient credential and scoped registry the same way', () => {
    expect(
      mergeNpmConfigEnv(
        {
          'npm_config_//reg.example.com/:_authToken': 'ambient-token',
          'npm_config_@myorg:registry': 'https://ambient.example.com/',
        },
        {},
        () => true
      )
    ).toEqual({});
  });

  it('keeps a setting the predicate says the package manager reads', () => {
    expect(
      mergeNpmConfigEnv(
        {
          'npm_config_//reg.example.com/:_authToken': 'ambient-token',
          NPM_CONFIG_REGISTRY: 'https://ambient.example.com/',
        },
        {},
        ignoresNpmConfigEnv('pnpm', '11.6.0')
      )
    ).toEqual({
      'npm_config_//reg.example.com/:_authToken': 'ambient-token',
    });
  });

  it('keeps an ambient setting outside the ones it resolves', () => {
    expect(
      mergeNpmConfigEnv(
        { npm_config_cache: '/cache', npm_config_userconfig: '/user/.npmrc' },
        {},
        () => true
      )
    ).toEqual({
      npm_config_cache: '/cache',
      npm_config_userconfig: '/user/.npmrc',
    });
  });

  it('drops even an empty ambient twin of an overlaid setting', () => {
    expect(
      mergeNpmConfigEnv(
        { NPM_CONFIG_REGISTRY: '' },
        { npm_config_registry: 'https://overlay.example.com/' }
      )
    ).toEqual({ npm_config_registry: 'https://overlay.example.com/' });
  });
});
