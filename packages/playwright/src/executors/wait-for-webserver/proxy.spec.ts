import { resolveProxyForUrl } from './proxy';

const PROXY_VARS = [
  'http_proxy',
  'HTTP_PROXY',
  'https_proxy',
  'HTTPS_PROXY',
  'all_proxy',
  'ALL_PROXY',
  'no_proxy',
  'NO_PROXY',
];

describe('resolveProxyForUrl', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {};
    for (const name of PROXY_VARS) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of PROXY_VARS) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
  });

  it('goes direct when nothing is configured', () => {
    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'direct',
    });
  });

  it.each(['http_proxy', 'HTTP_PROXY'])(
    'uses the proxy from %s for an http url',
    (name) => {
      process.env[name] = 'http://proxy.example:8080';

      expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
        kind: 'proxy',
        proxy: new URL('http://proxy.example:8080'),
      });
    }
  );

  it('keys the lookup on the protocol, like Playwright', () => {
    process.env.HTTPS_PROXY = 'http://proxy.example:8080';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'direct',
    });
    expect(resolveProxyForUrl(new URL('https://localhost:4200'))).toEqual({
      kind: 'proxy',
      proxy: new URL('http://proxy.example:8080'),
    });
  });

  it('falls back to all_proxy only when the protocol variable is unset', () => {
    process.env.ALL_PROXY = 'http://fallback.example:8080';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'proxy',
      proxy: new URL('http://fallback.example:8080'),
    });

    process.env.HTTP_PROXY = 'http://specific.example:8080';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'proxy',
      proxy: new URL('http://specific.example:8080'),
    });
  });

  it('treats an empty value as unset', () => {
    process.env.HTTP_PROXY = '';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'direct',
    });
  });

  it.each([
    { target: 'http://localhost:4200', expected: 'http://proxy.example:8080/' },
    {
      target: 'https://localhost:4200',
      expected: 'https://proxy.example:8080/',
    },
  ])(
    'gives a schemeless value the target protocol for $target',
    ({ target, expected }) => {
      process.env.HTTP_PROXY = 'proxy.example:8080';
      process.env.HTTPS_PROXY = 'proxy.example:8080';

      const resolution = resolveProxyForUrl(new URL(target));

      expect(resolution).toEqual({ kind: 'proxy', proxy: new URL(expected) });
    }
  );

  it('reports a proxy value that cannot be parsed instead of going direct', () => {
    process.env.HTTP_PROXY = 'http://not a proxy';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'unusable',
      variable: 'HTTP_PROXY',
      value: 'http://not a proxy',
      reason: 'is not a valid url',
    });
  });

  it('reports credentials that cannot be percent-decoded', () => {
    // Playwright decodes these too, so the request would fail on them either
    // way. Catching it here is what keeps the failure legible.
    process.env.http_proxy = 'http://user:100%@proxy.example:8080';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'unusable',
      variable: 'http_proxy',
      value: '***@proxy.example:8080',
      // The redaction takes the offending character with it, so the value on
      // its own would not show what is wrong.
      reason: 'has credentials that are not valid percent-encoding',
    });
  });

  it('keeps credentials out of the value it reports', () => {
    process.env.ALL_PROXY = 'http://user:s3cr3t@not a proxy:8080';

    expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
      kind: 'unusable',
      variable: 'ALL_PROXY',
      value: '***@not a proxy:8080',
      reason: 'is not a valid url',
    });
  });

  it.each(['socks5://127.0.0.1:1080', 'ftp://proxy.example:2121'])(
    'reports %s as a scheme it cannot send a request over',
    (value) => {
      process.env.HTTPS_PROXY = value;

      // Neither scheme fails on its own account otherwise, and which way it
      // fails late depends on the target rather than the value: an http one
      // throws out of `http.request`, and an https one has the agent dial the
      // proxy as if it spoke plain http.
      expect(resolveProxyForUrl(new URL('https://localhost:4200'))).toEqual({
        kind: 'unusable',
        variable: 'HTTPS_PROXY',
        value,
        reason: 'is not an http or https url',
      });
    }
  );

  describe('no_proxy', () => {
    beforeEach(() => {
      process.env.HTTP_PROXY = 'http://proxy.example:8080';
    });

    it('bypasses everything for *', () => {
      process.env.NO_PROXY = '*';

      expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
        kind: 'direct',
      });
    });

    it('bypasses an exact host', () => {
      process.env.NO_PROXY = 'localhost';

      expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
        kind: 'direct',
      });
      expect(resolveProxyForUrl(new URL('http://elsewhere:4200'))).toEqual({
        kind: 'proxy',
        proxy: new URL('http://proxy.example:8080'),
      });
    });

    it.each(['.example.com', '*.example.com'])(
      'bypasses a suffix written as %s',
      (entry) => {
        process.env.NO_PROXY = entry;

        expect(resolveProxyForUrl(new URL('http://app.example.com'))).toEqual({
          kind: 'direct',
        });
      }
    );

    it.each([', ', ' ', ','])(
      'accepts entries separated by "%s"',
      (separator) => {
        process.env.NO_PROXY = ['other.example', 'localhost'].join(separator);

        expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
          kind: 'direct',
        });
      }
    );

    it('honours a port on the entry', () => {
      process.env.NO_PROXY = 'localhost:4200';

      expect(resolveProxyForUrl(new URL('http://localhost:4200'))).toEqual({
        kind: 'direct',
      });
      expect(resolveProxyForUrl(new URL('http://localhost:5200'))).toEqual({
        kind: 'proxy',
        proxy: new URL('http://proxy.example:8080'),
      });
    });

    it('compares against the protocol default port when the url has none', () => {
      process.env.NO_PROXY = 'localhost:80';

      expect(resolveProxyForUrl(new URL('http://localhost'))).toEqual({
        kind: 'direct',
      });
    });

    it('keeps the brackets on an ipv6 host', () => {
      process.env.NO_PROXY = '[::1]';

      expect(resolveProxyForUrl(new URL('http://[::1]:4200'))).toEqual({
        kind: 'direct',
      });
    });
  });
});
