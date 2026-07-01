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
    'YARN_RC_FILENAME',
    'YARN_HTTPS_CA_FILE_PATH',
    'YARN_CA_FILE_PATH',
    'YARN_ENABLE_STRICT_SSL',
    'YARN_HTTP_PROXY',
    'YARN_HTTPS_PROXY',
    'BERRY_TEST_CA',
    'BERRY_TEST_REGISTRY',
    'BERRY_TEST_IDENT',
    'BERRY_TEST_TOKEN',
    'BERRY_TEST_PRIMARY',
    'BERRY_TEST_FALLBACK',
    '_BERRY_TEST_REGISTRY',
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
    // A more specific glob in the home file beats a broader one in the project.
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
    // Berry merges across all matching globs per key: cafile from the specific
    // glob, proxy from the wildcard glob, for host reg-a.example.com.
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
    // v3 whole-entry merge: the project ident wins, the home token is ignored.
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
});
