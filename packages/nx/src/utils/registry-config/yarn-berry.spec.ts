// os.homedir() ignores a runtime process.env.HOME override under jest, and a
// spyOn does not affect a module's named import either; replace both modules so
// the home lookup and the ancestor-walk file reads stay off the real FS.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/home/user'),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), verbose: jest.fn() },
}));

import * as fs from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { getYarnBerrySpawnRegistryEnv } from './yarn-berry';

describe('getYarnBerrySpawnRegistryEnv', () => {
  const ROOT = '/repo/workspace';
  const HOME = '/home/user';
  // .yarnrc.yml contents keyed by absolute path; absent paths read as missing.
  let files: Record<string, string>;
  const managedEnvKeys = [
    'YARN_NPM_REGISTRY_SERVER',
    'YARN_NPM_AUTH_TOKEN',
    'YARN_NPM_AUTH_IDENT',
    'YARN_NPM_ALWAYS_AUTH',
    'YARN_RC_FILENAME',
    'YARN_HTTPS_CA_FILE_PATH',
    'YARN_CA_FILE_PATH',
    'YARN_HTTPS_CERT_FILE_PATH',
    'YARN_HTTPS_KEY_FILE_PATH',
    'YARN_ENABLE_STRICT_SSL',
    'YARN_ENABLE_NETWORK',
    'YARN_HTTP_PROXY',
    'YARN_HTTPS_PROXY',
    'BERRY_TEST_CA',
    'BERRY_TEST_REGISTRY',
    'BERRY_TEST_IDENT',
    'BERRY_TEST_TOKEN',
    'BERRY_TEST_PRIMARY',
    'BERRY_TEST_FALLBACK',
    '_BERRY_TEST_REGISTRY',
    'npm_config_//reg-a.example.com/:_authToken',
    'NX_TEST_HOST',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    files = {};
    (homedir as jest.Mock).mockReturnValue(HOME);
    (fs.existsSync as jest.Mock).mockImplementation(
      (p: any) => typeof p === 'string' && p in files
    );
    (fs.readFileSync as jest.Mock).mockImplementation((p: any) => {
      if (typeof p === 'string' && p in files) {
        return files[p];
      }
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    });
    for (const key of managedEnvKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of managedEnvKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  const projectRc = (contents: string) =>
    (files[`${ROOT}/.yarnrc.yml`] = contents);
  const homeRc = (contents: string) =>
    (files[`${HOME}/.yarnrc.yml`] = contents);
  const ancestorRc = (contents: string) =>
    (files['/repo/.yarnrc.yml'] = contents);

  it('always injects the default registry (berry ignores .npmrc)', () => {
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
    });
  });

  it('injects the project npmRegistryServer', () => {
    projectRc('npmRegistryServer: https://reg-a.example.com/\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('lets YARN_NPM_REGISTRY_SERVER env beat the file', () => {
    process.env.YARN_NPM_REGISTRY_SERVER = 'https://reg-c.example.com/';
    projectRc('npmRegistryServer: https://reg-a.example.com/\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-c.example.com/',
    });
  });

  it('routes scoped packages through npmScopes and others through the default', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmScopes:',
        '  types:',
        '    npmRegistryServer: https://reg-e.example.com/',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@types/node', ROOT, '4.16.0')).toEqual(
      {
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
      }
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('uses the home .yarnrc.yml when the project does not define the key, project wins otherwise', () => {
    homeRc('npmRegistryServer: https://reg-f.example.com/\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-f.example.com/',
    });
    projectRc('npmRegistryServer: https://reg-a.example.com/\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('merges a scope entry per-key across rc files (registry from home, token from project)', () => {
    projectRc(
      ['npmScopes:', '  acme:', '    npmAuthToken: project-token'].join('\n')
    );
    homeRc(
      [
        'npmScopes:',
        '  acme:',
        '    npmRegistryServer: https://reg-acme.example.com/',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      'npm_config_@acme:registry': 'https://reg-acme.example.com/',
      'npm_config_//reg-acme.example.com/:_authToken': 'project-token',
    });
  });

  it('routes a configured-but-registry-less scope to the yarnpkg default, not the top-level registry', () => {
    // berry seeds an omitted scope npmRegistryServer to registry.yarnpkg.com and
    // returns it directly, so an auth-only scope does NOT inherit the custom
    // top-level registry.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmScopes:',
        '  acme:',
        '    npmAuthToken: acme-tok',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@acme:registry': 'https://registry.yarnpkg.com',
      'npm_config_//registry.yarnpkg.com/:_authToken': 'acme-tok',
    });
  });

  it('routes an unconfigured @jsr scope to npm.jsr.io on yarn >= 4.9.0', () => {
    expect(
      getYarnBerrySpawnRegistryEnv('@jsr/std__foo', ROOT, '4.9.0')
    ).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      'npm_config_@jsr:registry': 'https://npm.jsr.io',
    });
  });

  it('does not special-case @jsr before yarn 4.9.0', () => {
    expect(
      getYarnBerrySpawnRegistryEnv('@jsr/std__foo', ROOT, '4.8.1')
    ).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      'npm_config_@jsr:registry': 'https://registry.yarnpkg.com',
    });
  });

  it('translates a global npmAuthToken to a nerf-darted key for the effective registry', () => {
    // npmAlwaysAuth so the unscoped fetch authenticates (berry gates it).
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAlwaysAuth: true',
        'npmAuthToken: secret-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'secret-token',
    });
  });

  it('does not authenticate an unscoped fetch without npmAlwaysAuth (berry CONFIGURATION default)', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAuthToken: secret-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  // Berry coerces a Boolean setting through miscUtils.parseBoolean, so 1, '1'
  // and 'true' all enable it; a literal `=== true` check sees only the first
  // YAML form and silently drops the credential from an unscoped fetch.
  it.each(['npmAlwaysAuth: 1', `npmAlwaysAuth: '1'`, `npmAlwaysAuth: 'true'`])(
    'authenticates an unscoped fetch for a berry-truthy %s',
    (setting) => {
      projectRc(
        [
          'npmRegistryServer: https://reg-a.example.com/',
          setting,
          'npmAuthToken: secret-token',
        ].join('\n')
      );
      expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'secret-token',
      });
    }
  );

  it.each([
    'npmAlwaysAuth: 0',
    `npmAlwaysAuth: '0'`,
    'npmAlwaysAuth: false',
    // Outside both of parseBoolean's sets berry aborts, so nothing is left to
    // reproduce; withholding the credential is the safe reading.
    'npmAlwaysAuth: yes',
  ])('leaves an unscoped fetch unauthenticated for %s', (setting) => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        setting,
        'npmAuthToken: secret-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('honors YARN_NPM_ALWAYS_AUTH=1 over the rc file', () => {
    process.env.YARN_NPM_ALWAYS_AUTH = '1';
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAlwaysAuth: false',
        'npmAuthToken: secret-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'secret-token',
    });
  });

  it('honors a numeric npmAlwaysAuth on an npmRegistries entry', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAlwaysAuth: 1',
        '    npmAuthToken: registry-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'registry-token',
    });
  });

  it('still authenticates a scoped fetch without npmAlwaysAuth (berry BEST_EFFORT)', () => {
    projectRc(
      [
        'npmScopes:',
        '  types:',
        '    npmRegistryServer: https://reg-e.example.com/',
        '    npmAuthToken: scope-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@types/node', ROOT, '4.16.0')).toEqual(
      {
        npm_config_registry: 'https://registry.yarnpkg.com',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
        'npm_config_//reg-e.example.com/:_authToken': 'scope-token',
      }
    );
  });

  it('prefers scope auth, then npmRegistries auth, over global auth', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAuthToken: global-token',
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAlwaysAuth: true',
        '    npmAuthToken: registry-token',
        'npmScopes:',
        '  types:',
        '    npmRegistryServer: https://reg-e.example.com/',
        '    npmAuthToken: scope-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@types/node', ROOT, '4.16.0')).toEqual(
      {
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
        'npm_config_//reg-e.example.com/:_authToken': 'scope-token',
      }
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'registry-token',
    });
  });

  it('uses a scope ident even when global defines a token (single-object selection)', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAuthToken: global-token',
        'npmScopes:',
        '  types:',
        '    npmRegistryServer: https://reg-e.example.com/',
        '    npmAuthIdent: "user:pass"',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@types/node', ROOT, '4.16.0')).toEqual(
      {
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
        'npm_config_//reg-e.example.com/:_auth':
          Buffer.from('user:pass').toString('base64'),
      }
    );
  });

  it('does not let YARN_NPM_AUTH_TOKEN env override a scope token', () => {
    process.env.YARN_NPM_AUTH_TOKEN = 'env-token';
    projectRc(
      [
        'npmScopes:',
        '  types:',
        '    npmRegistryServer: https://reg-e.example.com/',
        '    npmAuthToken: scope-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@types/node', ROOT, '4.16.0')).toEqual(
      {
        npm_config_registry: 'https://registry.yarnpkg.com',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
        'npm_config_//reg-e.example.com/:_authToken': 'scope-token',
      }
    );
  });

  it('encodes npmAuthIdent for npm: v3/v4 base64-encode a user:pass value, v2 passes it through pre-encoded', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAlwaysAuth: true',
        'npmAuthIdent: "user:pass"',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_auth':
        Buffer.from('user:pass').toString('base64'),
    });
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '2.4.2')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_auth': 'user:pass',
    });
  });

  it('bridges httpsCaFilePath (v4) resolved relative to the rc file, and enableStrictSsl', () => {
    projectRc(
      ['httpsCaFilePath: ./certs/ca.pem', 'enableStrictSsl: false'].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: resolve(ROOT, './certs/ca.pem'),
      npm_config_strict_ssl: 'false',
    });
  });

  it('bridges caFilePath on v3', () => {
    projectRc('caFilePath: ./certs/ca.pem\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '3.8.7')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: resolve(ROOT, './certs/ca.pem'),
    });
  });

  it('expands ${VAR} in a caFilePath before resolving', () => {
    process.env.BERRY_TEST_CA = '/etc/ssl';
    projectRc('httpsCaFilePath: ${BERRY_TEST_CA}/ca.pem\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: resolve(ROOT, '/etc/ssl/ca.pem'),
    });
  });

  it('applies per-host networkSettings over the global TLS keys', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'httpsCaFilePath: ./certs/global-ca.pem',
        'networkSettings:',
        '  "reg-a.example.com":',
        '    httpsCaFilePath: ./certs/reg-a-ca.pem',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(ROOT, './certs/reg-a-ca.pem'),
    });
  });

  it('picks the longest networkSettings host glob across merged rc files', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'networkSettings:',
        '  "*.example.com":',
        '    httpsCaFilePath: ./certs/wild-ca.pem',
      ].join('\n')
    );
    homeRc(
      [
        'networkSettings:',
        '  "reg-a.example.com":',
        '    httpsCaFilePath: ./certs/specific-ca.pem',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(HOME, './certs/specific-ca.pem'),
    });
  });

  it('reads npmRegistryServer from an ancestor .yarnrc.yml', () => {
    ancestorRc('npmRegistryServer: https://reg-anc.example.com/\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-anc.example.com/',
    });
  });

  it('fills each networkSettings key from a different matching glob', () => {
    // Berry merges across all matching globs per key.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'networkSettings:',
        '  "reg-a.example.com":',
        '    httpsCaFilePath: ./certs/specific-ca.pem',
        '  "*.example.com":',
        '    httpProxy: http://proxy.example.com:8080',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(ROOT, './certs/specific-ca.pem'),
      npm_config_proxy: 'http://proxy.example.com:8080',
    });
  });

  it('emits no auth when an npmRegistries entry exists without credentials', () => {
    // A present-but-credential-less entry stops berry's auth search; it must NOT
    // fall back to the global npmAuthToken.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAuthToken: global-token',
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAlwaysAuth: true',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('merges an npmRegistries entry per sub-key across files on v4 (token wins)', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAlwaysAuth: true',
        '    npmAuthIdent: "user:pass"',
      ].join('\n')
    );
    homeRc(
      [
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAuthToken: SECRET',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'SECRET',
    });
  });

  it('keeps the highest-priority file npmRegistries entry whole on v3 (no cross-file mix)', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAlwaysAuth: true',
        '    npmAuthIdent: "user:pass"',
      ].join('\n')
    );
    homeRc(
      [
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAuthToken: SECRET',
      ].join('\n')
    );
    // v3 does a whole-entry merge, not a per-key merge like v4.
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '3.8.7')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_auth':
        Buffer.from('user:pass').toString('base64'),
    });
  });

  it('expands ${VAR} in npmRegistryServer before nerf-darting its auth', () => {
    // Without expansion the registry stays `${BERRY_TEST_REGISTRY}`, which fails
    // to parse as a URL, so no auth key is ever emitted for the real host.
    process.env.BERRY_TEST_REGISTRY = 'https://reg-env.example.com/';
    projectRc(
      [
        'npmRegistryServer: "${BERRY_TEST_REGISTRY}"',
        'npmAlwaysAuth: true',
        'npmAuthToken: secret-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-env.example.com/',
      'npm_config_//reg-env.example.com/:_authToken': 'secret-token',
    });
  });

  it('expands ${VAR} in a scoped npmRegistryServer and keys auth to the expanded host', () => {
    process.env.BERRY_TEST_REGISTRY = 'https://reg-scope-env.example.com/';
    projectRc(
      [
        'npmScopes:',
        '  acme:',
        '    npmRegistryServer: "${BERRY_TEST_REGISTRY}"',
        '    npmAuthToken: acme-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      'npm_config_@acme:registry': 'https://reg-scope-env.example.com/',
      'npm_config_//reg-scope-env.example.com/:_authToken': 'acme-token',
    });
  });

  it('expands ${VAR} in npmAuthIdent before the base64 decision', () => {
    // The expanded value `user:pass` contains a `:`, so v4 base64-encodes it;
    // the raw `${BERRY_TEST_IDENT}` has no `:` and would be passed through.
    process.env.BERRY_TEST_IDENT = 'user:pass';
    projectRc(
      [
        'npmScopes:',
        '  types:',
        '    npmRegistryServer: https://reg-e.example.com/',
        '    npmAuthIdent: "${BERRY_TEST_IDENT}"',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@types/node', ROOT, '4.16.0')).toEqual(
      {
        npm_config_registry: 'https://registry.yarnpkg.com',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
        'npm_config_//reg-e.example.com/:_auth':
          Buffer.from('user:pass').toString('base64'),
      }
    );
  });

  it('expands ${VAR} in an auth token value', () => {
    process.env.BERRY_TEST_TOKEN = 'real-secret';
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAlwaysAuth: true',
        'npmAuthToken: "${BERRY_TEST_TOKEN}"',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'real-secret',
    });
  });

  it('honors a ${VAR:-default} operator in caFilePath', () => {
    delete process.env.BERRY_UNSET_CA;
    projectRc('httpsCaFilePath: ${BERRY_UNSET_CA:-./certs/fallback-ca.pem}\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: resolve(ROOT, './certs/fallback-ca.pem'),
    });
  });

  it('resolves a nested ${A:-${B}} default to the inner var when the outer is unset', () => {
    delete process.env.BERRY_TEST_PRIMARY;
    process.env.BERRY_TEST_FALLBACK = 'https://reg-fallback.example.com/';
    projectRc(
      'npmRegistryServer: ${BERRY_TEST_PRIMARY:-${BERRY_TEST_FALLBACK}}\n'
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-fallback.example.com/',
    });
  });

  it('uses the outer var of a nested ${A:-${B}} default without leaking a brace', () => {
    process.env.BERRY_TEST_PRIMARY = 'https://reg-primary.example.com/';
    process.env.BERRY_TEST_FALLBACK = 'https://reg-fallback.example.com/';
    projectRc(
      [
        'npmRegistryServer: ${BERRY_TEST_PRIMARY:-${BERRY_TEST_FALLBACK}}',
        'npmAlwaysAuth: true',
        'npmAuthToken: tok',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-primary.example.com/',
      'npm_config_//reg-primary.example.com/:_authToken': 'tok',
    });
  });

  it('treats a \\${VAR} escape as a literal ${VAR} (berry escape)', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAlwaysAuth: true',
        "npmAuthToken: '\\${NOT_A_VAR}'",
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': '${NOT_A_VAR}',
    });
  });

  it('expands an underscore-leading ${_VAR} for berry < 4.13 (legacy parser)', () => {
    // Berry <= 4.12 accepts [\d\w_]+ env names, so ${_VAR} resolves the way yarn
    // would; the registry auth then darts to the expanded host.
    process.env._BERRY_TEST_REGISTRY = 'https://reg-legacy.example.com/';
    projectRc(
      [
        'npmRegistryServer: "${_BERRY_TEST_REGISTRY}"',
        'npmAlwaysAuth: true',
        'npmAuthToken: legacy-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.12.0')).toEqual({
      npm_config_registry: 'https://reg-legacy.example.com/',
      'npm_config_//reg-legacy.example.com/:_authToken': 'legacy-token',
    });
  });

  it('leaves an underscore-leading ${_VAR} literal for berry >= 4.13 (regex tightened)', () => {
    // 4.13 rewrote the parser to [a-zA-Z]\w*, so ${_VAR} is malformed (berry
    // itself throws). The reference is left literal, which fails to parse as a
    // registry URL, so no auth is darted.
    process.env._BERRY_TEST_REGISTRY = 'https://reg-legacy.example.com/';
    projectRc(
      [
        'npmRegistryServer: "${_BERRY_TEST_REGISTRY}"',
        'npmAlwaysAuth: true',
        'npmAuthToken: legacy-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.13.0')).toEqual({
      npm_config_registry: '${_BERRY_TEST_REGISTRY}',
    });
  });

  it('expands a standard ${VAR} through the legacy parser for berry 3.x', () => {
    process.env.BERRY_TEST_REGISTRY = 'https://reg-3x.example.com/';
    projectRc('npmRegistryServer: "${BERRY_TEST_REGISTRY}"\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '3.8.7')).toEqual({
      npm_config_registry: 'https://reg-3x.example.com/',
    });
  });

  it('honors a ${_VAR:-default} operator in the legacy parser', () => {
    delete process.env._BERRY_TEST_REGISTRY;
    projectRc(
      'npmRegistryServer: "${_BERRY_TEST_REGISTRY:-https://reg-def.example.com/}"\n'
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.12.0')).toEqual({
      npm_config_registry: 'https://reg-def.example.com/',
    });
  });

  it('disables TLS for a numeric enableStrictSsl: 0 (berry parseBoolean)', () => {
    projectRc('enableStrictSsl: 0\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_strict_ssl: 'false',
    });
  });

  it('disables TLS for YARN_ENABLE_STRICT_SSL=0', () => {
    process.env.YARN_ENABLE_STRICT_SSL = '0';
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_strict_ssl: 'false',
    });
  });

  it('keeps TLS on for a numeric enableStrictSsl: 1', () => {
    projectRc('enableStrictSsl: 1\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_strict_ssl: 'true',
    });
  });

  // Berry aborts on either shape, so dropping the file and carrying on would
  // aim the injected credential at registry.yarnpkg.com, a host the workspace
  // never configured. The caller turns the throw into no bridging at all.
  it('fails on an rc file that does not parse', () => {
    projectRc(
      [
        'npmRegistryServer: "https://reg-a.example.com/',
        '  bad: [unclosed',
      ].join('\n')
    );
    homeRc('npmAuthToken: home-token\n');
    expect(() =>
      getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')
    ).toThrow();
  });

  // The parse error quotes the lines around the fault, so it carries whatever
  // credential sits next to the mistake.
  it('keeps the rc file contents out of the failure it reports', () => {
    projectRc(
      ['npmAuthToken: ghp_ShortTok99', 'npmRegistryServer: "unclosed'].join(
        '\n'
      )
    );
    let message = '';
    try {
      getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0');
    } catch (e) {
      message = e.message;
    }
    expect(message).toContain(`${ROOT}/.yarnrc.yml`);
    expect(message).not.toContain('ghp_ShortTok99');
  });

  // yarn reads a repeated key as last-wins (@yarnpkg/parsers loads with
  // json: true), so a file yarn 4.15.0 accepts must resolve here too.
  it('reads an rc file that repeats a key, the last one winning', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAuthToken: tok-one',
        'npmAuthToken: tok-two',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@acme:registry': 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'tok-two',
    });
  });

  it('fails on an rc file that is not a settings mapping', () => {
    projectRc('npmRegistryServer "https://reg-a.example.com/"\n');
    expect(() =>
      getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')
    ).toThrow(/not a settings mapping/);
  });

  it('treats an empty or comment-only rc file as a config that declares nothing', () => {
    projectRc('# nothing here\n');
    ancestorRc('');
    homeRc('npmRegistryServer: https://reg-f.example.com/\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-f.example.com/',
    });
  });

  it('keeps an unquoted numeric token a string (berry parses rc files failsafe)', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmAlwaysAuth: true',
        'npmAuthToken: 12345',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': '12345',
    });
  });

  it('keeps a bare tilde caFilePath a literal path (berry does not read it as null)', () => {
    projectRc('httpsCaFilePath: ~\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: resolve(ROOT, './~'),
    });
  });

  it('treats a null npmScopes as declaring no scope at all', () => {
    projectRc(
      ['npmRegistryServer: https://reg-a.example.com/', 'npmScopes:'].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@acme:registry': 'https://reg-a.example.com/',
    });
  });

  it('treats a null npmScopes entry as a configured scope with defaults', () => {
    // Berry seeds a configured scope's registry to its own default rather than
    // to the top-level npmRegistryServer.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmScopes:',
        '  acme:',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@acme:registry': 'https://registry.yarnpkg.com',
    });
  });

  it('fails on a scalar npmScopes (berry rejects the shape)', () => {
    projectRc('npmScopes: hello\n');
    expect(() =>
      getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')
    ).toThrow(/"npmScopes" in .* is not an object/);
  });

  it('fails on a scalar npmScopes entry (berry rejects the shape)', () => {
    projectRc('npmScopes:\n  acme: hello\n');
    expect(() =>
      getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')
    ).toThrow(/"npmScopes\["acme"\]" in .* is not an object/);
  });

  it('treats a null networkSettings host entry as declaring no override', () => {
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'httpsCaFilePath: ./certs/global-ca.pem',
        'networkSettings:',
        '  "reg-a.example.com":',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(ROOT, './certs/global-ca.pem'),
    });
  });

  it('prefers an exact npmRegistries key over a scheme-less one in a closer file', () => {
    // Berry looks the registry up in the merged map by exact key first, so the
    // home file's exact key wins over the project file's scheme-less key.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'npmRegistries:',
        '  "//reg-a.example.com":',
        '    npmAuthToken: scheme-less-token',
      ].join('\n')
    );
    homeRc(
      [
        'npmRegistries:',
        '  "https://reg-a.example.com":',
        '    npmAuthToken: exact-token',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('@acme/pkg', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_@acme:registry': 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:_authToken': 'exact-token',
    });
  });

  it('reads a networkSettings glob the way micromatch does, not minimatch', () => {
    // A bare (a|b) is an alternation for berry, and a leading ! opens an extglob
    // rather than negating the whole pattern.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'networkSettings:',
        '  "(reg-a|reg-b).example.com":',
        '    httpProxy: http://alt-proxy.example.com:8080',
        '  "!(reg-a).example.com":',
        '    httpsCaFilePath: ./certs/other-ca.pem',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_proxy: 'http://alt-proxy.example.com:8080',
    });
  });

  it('resolves equal-length networkSettings globs lowest rc file first', () => {
    // Berry builds the merged map from the lowest-priority file up and sorts it
    // stably by key length, so the home file's glob is consulted first.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'networkSettings:',
        '  "reg-?.example.com":',
        '    httpsCaFilePath: ./certs/project-ca.pem',
      ].join('\n')
    );
    homeRc(
      [
        'networkSettings:',
        '  "reg-a.example.???":',
        '    httpsCaFilePath: ./certs/home-ca.pem',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(HOME, './certs/home-ca.pem'),
    });
  });

  it('lets a per-host networkSettings CA outrank the YARN_* env var', () => {
    // getNetworkSettings only falls back to the global setting (which is where
    // the env var lands) for the keys no matching host entry declared.
    process.env.YARN_HTTPS_CA_FILE_PATH = '/etc/ssl/env-ca.pem';
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'networkSettings:',
        '  "reg-a.example.com":',
        '    httpsCaFilePath: ./certs/host-ca.pem',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      npm_config_cafile: resolve(ROOT, './certs/host-ca.pem'),
    });
  });

  it('keeps the YARN_* CA env var ahead of the rc files', () => {
    process.env.YARN_HTTPS_CA_FILE_PATH = '/etc/ssl/env-ca.pem';
    projectRc('httpsCaFilePath: ./certs/rc-ca.pem\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: '/etc/ssl/env-ca.pem',
    });
  });

  it('ignores the CA env var and setting the running major rejects', () => {
    // v4 renamed caFilePath to httpsCaFilePath, and berry aborts on the name it
    // does not know, under YARN_* just as much as in the rc file.
    process.env.YARN_CA_FILE_PATH = '/etc/ssl/v3-env-ca.pem';
    projectRc('caFilePath: ./certs/v3-ca.pem\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
    });
  });

  it('reads the v3 CA env var on v3', () => {
    process.env.YARN_CA_FILE_PATH = '/etc/ssl/v3-env-ca.pem';
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '3.8.7')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      npm_config_cafile: '/etc/ssl/v3-env-ca.pem',
    });
  });

  describe('a host yarn refuses to reach', () => {
    // enableNetwork: false makes berry exit without contacting the registry
    // (verified on 4.15.0), and npm has no setting that reproduces it.
    const warnOnce = (rc: string, versions: string[]): string[] => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      projectRc(rc);
      jest.isolateModules(() => {
        const { getYarnBerrySpawnRegistryEnv: fresh } = require('./yarn-berry');
        for (const version of versions) {
          fresh('is-even', ROOT, version);
        }
      });
      return (logger.warn as jest.Mock).mock.calls.map((call) => call[0]);
    };

    it('reports a global enableNetwork once', () => {
      const messages = warnOnce(
        [
          'npmRegistryServer: https://reg-a.example.com/',
          'enableNetwork: false',
        ].join('\n'),
        ['4.16.0', '4.16.0']
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('reg-a.example.com');
    });

    it('reports a per-host enableNetwork for the registry it resolved', () => {
      const messages = warnOnce(
        [
          'npmRegistryServer: https://reg-a.example.com/',
          'networkSettings:',
          '  "reg-a.example.com":',
          '    enableNetwork: false',
        ].join('\n'),
        ['4.16.0']
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('reg-a.example.com');
    });

    it('stays quiet when another host is the one cut off', () => {
      const messages = warnOnce(
        [
          'npmRegistryServer: https://reg-a.example.com/',
          'networkSettings:',
          '  "reg-other.example.com":',
          '    enableNetwork: false',
        ].join('\n'),
        ['4.16.0']
      );
      expect(messages).toEqual([]);
    });

    it('lets a per-host entry re-enable the network globally turned off', () => {
      // getNetworkSettings reads the matching host entry before the global
      // value, so the narrower setting is the one that applies.
      const messages = warnOnce(
        [
          'npmRegistryServer: https://reg-a.example.com/',
          'enableNetwork: false',
          'networkSettings:',
          '  "reg-a.example.com":',
          '    enableNetwork: true',
        ].join('\n'),
        ['4.16.0']
      );
      expect(messages).toEqual([]);
    });

    it('reports the env var too', () => {
      process.env.YARN_ENABLE_NETWORK = 'false';
      const messages = warnOnce(
        'npmRegistryServer: https://reg-a.example.com/\n',
        ['4.16.0']
      );
      expect(messages).toHaveLength(1);
    });
  });

  it('bridges a client certificate as a pair', () => {
    projectRc(
      [
        'httpsCertFilePath: ./certs/client.crt',
        'httpsKeyFilePath: ./certs/client.key',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      'npm_config_//registry.yarnpkg.com/:certfile': resolve(
        ROOT,
        './certs/client.crt'
      ),
      'npm_config_//registry.yarnpkg.com/:keyfile': resolve(
        ROOT,
        './certs/client.key'
      ),
    });
  });

  it('emits neither half of an incomplete client certificate', () => {
    // Berry presents nothing without the key, and npm reads the pair the same
    // way, so a lone certfile would only be dead config in the overlay.
    projectRc('httpsCertFilePath: ./certs/client.crt\n');
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
    });
  });

  it('fills the client certificate per host and the key globally', () => {
    // getNetworkSettings fills each key independently, so a per-host cert and a
    // global key are the one pair berry ends up presenting.
    projectRc(
      [
        'npmRegistryServer: https://reg-a.example.com/',
        'httpsKeyFilePath: ./certs/global.key',
        'networkSettings:',
        '  "reg-a.example.com":',
        '    httpsCertFilePath: ./certs/host.crt',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '4.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
      'npm_config_//reg-a.example.com/:certfile': resolve(
        ROOT,
        './certs/host.crt'
      ),
      'npm_config_//reg-a.example.com/:keyfile': resolve(
        ROOT,
        './certs/global.key'
      ),
    });
  });

  it('reads the client certificate from the YARN_* env vars', () => {
    process.env.YARN_HTTPS_CERT_FILE_PATH = '/etc/ssl/env.crt';
    process.env.YARN_HTTPS_KEY_FILE_PATH = '/etc/ssl/env.key';
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '3.8.7')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
      'npm_config_//registry.yarnpkg.com/:certfile': '/etc/ssl/env.crt',
      'npm_config_//registry.yarnpkg.com/:keyfile': '/etc/ssl/env.key',
    });
  });

  it('ignores the client certificate settings below 3.2.0', () => {
    // berry did not know the names yet and aborts on them, so there is no
    // resolution to reproduce.
    process.env.YARN_HTTPS_CERT_FILE_PATH = '/etc/ssl/env.crt';
    process.env.YARN_HTTPS_KEY_FILE_PATH = '/etc/ssl/env.key';
    projectRc(
      [
        'httpsCertFilePath: ./certs/client.crt',
        'httpsKeyFilePath: ./certs/client.key',
      ].join('\n')
    );
    expect(getYarnBerrySpawnRegistryEnv('is-even', ROOT, '3.1.1')).toEqual({
      npm_config_registry: 'https://registry.yarnpkg.com',
    });
  });

  describe('reporting a credential berry would not send', () => {
    // berry never reads an .npmrc, so a credential one holds for the registry
    // berry resolved is one berry itself would never send.
    const warnFor = (packages: string[]): string[] => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      jest.isolateModules(() => {
        const { getYarnBerrySpawnRegistryEnv: fresh } = require('./yarn-berry');
        for (const pkg of packages) {
          fresh(pkg, ROOT, '4.16.0');
        }
      });
      return (logger.warn as jest.Mock).mock.calls.map((call) => call[0]);
    };

    beforeEach(() => {
      projectRc('npmRegistryServer: https://reg-a.example.com/\n');
      files[`${ROOT}/.npmrc`] =
        '//reg-a.example.com/:_authToken=native-token\n';
    });

    it('warns once when npm authenticates on a registry berry resolved', () => {
      const warnings = warnFor(['is-even', 'is-odd']);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('//reg-a.example.com/');
      // Safe advice here only because berry reads no .npmrc at all.
      expect(warnings[0]).toContain('Remove that credential from .npmrc');
    });

    it('warns for a scoped fetch too, since berry still reads no .npmrc', () => {
      expect(warnFor(['@acme/pkg'])).toHaveLength(1);
    });

    it('stays quiet when berry supplies the credential itself', () => {
      // The overlay carries berry's own token, which outranks the .npmrc, so
      // npm sends what berry would have sent.
      projectRc(
        [
          'npmRegistryServer: https://reg-a.example.com/',
          'npmAuthToken: berry-token',
          'npmAlwaysAuth: true',
        ].join('\n') + '\n'
      );
      expect(warnFor(['is-even'])).toEqual([]);
    });

    it('stays quiet when the .npmrc holds nothing for that registry', () => {
      files[`${ROOT}/.npmrc`] =
        '//other.example.com/:_authToken=native-token\n';
      expect(warnFor(['is-even'])).toEqual([]);
    });

    it('does not count an ambient credential the berry spawn strips', () => {
      // berry ignores npm_config_*, so the spawn drops this ambient token before
      // npm runs; the .npmrc holds nothing for reg-a, so npm fetches it anonymously.
      files[`${ROOT}/.npmrc`] =
        '//other.example.com/:_authToken=native-token\n';
      process.env['npm_config_//reg-a.example.com/:_authToken'] = 'env-token';
      expect(warnFor(['is-even'])).toEqual([]);
    });

    it('counts a native credential whose key holds an env reference', () => {
      // npm expands ${VAR} in an .npmrc key, so this token authenticates reg-a,
      // and berry, reading no .npmrc, would not send it.
      process.env.NX_TEST_HOST = 'reg-a.example.com';
      files[`${ROOT}/.npmrc`] = '//${NX_TEST_HOST}/:_authToken=native-token\n';
      const warnings = warnFor(['is-even']);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('//reg-a.example.com/');
    });
  });
});
