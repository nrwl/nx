jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), verbose: jest.fn() },
}));

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getPnpmSpawnRegistryEnv } from './pnpm';

describe('getPnpmSpawnRegistryEnv', () => {
  let root: string;
  let configHome: string;
  const managedEnvKeys = [
    'npm_config_registry',
    'NPM_CONFIG_REGISTRY',
    'Npm_Config_Registry',
    'pnpm_config_registry',
    'PNPM_CONFIG_REGISTRY',
    'pnpm_config_strict_ssl',
    'PNPM_CONFIG_STRICT_SSL',
    'pnpm_config_proxy',
    'PNPM_CONFIG_PROXY',
    'pnpm_config_https_proxy',
    'PNPM_CONFIG_HTTPS_PROXY',
    'pnpm_config_http_proxy',
    'PNPM_CONFIG_HTTP_PROXY',
    'pnpm_config_no_proxy',
    'PNPM_CONFIG_NO_PROXY',
    'pnpm_config_noproxy',
    'PNPM_CONFIG_NOPROXY',
    'pnpm_config_cafile',
    'PNPM_CONFIG_CAFILE',
    'npm_config_//reg-a.example.com/:_authToken',
    'npm_config_//reg-b.example.com/:_authToken',
    'pnpm_config_//reg-a.example.com/:_authToken',
    'pnpm_config_//reg-a.example.com/:cert',
    'npm_config_//reg-a.example.com/:cert',
    'PNPM_CONFIG_//reg-b.example.com/:_authToken',
    'pnpm_config_//reg-a.example.com/:tokenHelper',
    'pnpm_config_//reg-a.example.com/:username',
    'PNPM_TEST_NOPROXY',
    'PNPM_TEST_HELPER',
    'NX_TEST_HOST',
    'NX_TEST_TOKEN',
    'NX_TEST_TLS_KEY',
    'NX_TEST_SCOPE',
    'XDG_CONFIG_HOME',
    'pnpm_config_npmrc_auth_file',
    'PNPM_CONFIG_NPMRC_AUTH_FILE',
    'pnpm_config__auth',
    'PNPM_CONFIG__AUTH',
    'pnpm_config_userconfig',
    'PNPM_CONFIG_USERCONFIG',
    'npm_config_userconfig',
    'NPM_CONFIG_USERCONFIG',
    'NPM_CONFIG_WORKSPACE_DIR',
    'npm_config_workspace_dir',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-registry-pnpm-'));
    configHome = mkdtempSync(join(tmpdir(), 'nx-registry-pnpm-cfg-'));
    for (const key of managedEnvKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // pnpm derives its config dir, which holds auth.ini, from this.
    process.env.XDG_CONFIG_HOME = configHome;
    // npm's user config and the last link of pnpm's user-auth-file chain, pinned so
    // no test reads the real ~/.npmrc.
    process.env.NPM_CONFIG_USERCONFIG = join(configHome, 'user.npmrc');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(configHome, { recursive: true, force: true });
    for (const key of managedEnvKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  function writeYaml(contents: string): void {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), contents);
  }
  function writeAuthIni(contents: string): void {
    mkdirSync(join(configHome, 'pnpm'), { recursive: true });
    writeFileSync(join(configHome, 'pnpm', 'auth.ini'), contents);
  }
  function writeGlobalConfigYaml(contents: string): void {
    mkdirSync(join(configHome, 'pnpm'), { recursive: true });
    writeFileSync(join(configHome, 'pnpm', 'config.yaml'), contents);
  }
  /** The file both pnpm and npm resolve as the user config. */
  function writeUserConfig(contents: string): void {
    writeFileSync(join(configHome, 'user.npmrc'), contents);
  }
  function writePnpmOnlyUserConfig(contents: string): void {
    const path = join(configHome, 'pnpm-only.npmrc');
    writeFileSync(path, contents);
    process.env.PNPM_CONFIG_NPMRC_AUTH_FILE = path;
  }

  it('returns nothing when the version is unknown', () => {
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, null)).toEqual({});
  });

  it('fails on a pnpm-workspace.yaml that does not parse', () => {
    // pnpm aborts on it, so there is no resolution left to reproduce. Reading it as
    // an empty document would silently drop the registry and send npm to npmjs.
    writeYaml('registries:\n\tdefault: https://reg-a.example.com/\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
      /pnpm workspace file at .* could not be read/
    );
  });

  it('fails on a yaml registry of the wrong shape, the way pnpm dies picking it', () => {
    writeYaml('registries:\n  default:\n    nested: true\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
      /declares a registries\["default"\] that is not a string/
    );
  });

  it('tolerates a wrong-shaped registry for a scope the fetch never picks', () => {
    // pnpm only dies on the registry it picks for the fetched package, so a
    // fatal here would drop a resolution pnpm carries out fine.
    writeYaml(
      'registries:\n  default: https://reg-a.example.com/\n  "@other":\n    nested: true\n'
    );
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('treats a null or non-map registries as declaring nothing, the way pnpm does', () => {
    writeYaml('registries:\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    writeYaml('registries:\n  - https://reg-a.example.com/\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
  });

  it('reads a pnpm-workspace.yaml an ancestor declares, the way pnpm walks up to it', () => {
    // pnpm resolves the file by walking up from the directory it runs in, so a
    // workspace nested under another one resolves through the outer file.
    const nested = join(root, 'nested');
    mkdirSync(nested);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('stops that walk at the nearest pnpm-workspace.yaml', () => {
    const nested = join(root, 'nested');
    mkdirSync(nested);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    writeFileSync(
      join(nested, 'pnpm-workspace.yaml'),
      'registries:\n  default: https://reg-b.example.com/\n'
    );
    expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
    });
  });

  it('takes the workspace directory from NPM_CONFIG_WORKSPACE_DIR instead of walking up', () => {
    // pnpm joins the manifest name onto that directory and skips the lookup, so
    // the file the walk would have found never comes into it.
    const nested = join(root, 'nested');
    const elsewhere = join(root, 'elsewhere');
    mkdirSync(nested);
    mkdirSync(elsewhere);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    writeFileSync(
      join(elsewhere, 'pnpm-workspace.yaml'),
      'registries:\n  default: https://reg-b.example.com/\n'
    );
    process.env.NPM_CONFIG_WORKSPACE_DIR = elsewhere;
    expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
    });
    expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
    });
  });

  it('falls back to the lowercase spelling only while the uppercase one is unset', () => {
    // pnpm reaches for the lowercase entry with `??`, so an uppercase one set to
    // an empty string shadows it, and being falsy sends pnpm back to the walk.
    const elsewhere = join(root, 'elsewhere');
    mkdirSync(elsewhere);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    writeFileSync(
      join(elsewhere, 'pnpm-workspace.yaml'),
      'registries:\n  default: https://reg-b.example.com/\n'
    );
    process.env.npm_config_workspace_dir = elsewhere;
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-b.example.com/',
    });
    process.env.NPM_CONFIG_WORKSPACE_DIR = '';
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('reads a NPM_CONFIG_WORKSPACE_DIR without a manifest as a workspace declaring nothing', () => {
    // pnpm never checks that the file is there, so the directory it was pointed
    // at stays the workspace rather than the lookup resuming above it.
    const nested = join(root, 'nested');
    mkdirSync(nested);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    process.env.NPM_CONFIG_WORKSPACE_DIR = nested;
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
  });

  it('fails on a misspelled workspace manifest, the way pnpm refuses to look past one', () => {
    // pnpm searches the misspellings alongside the real name and aborts on a hit
    // (BAD_WORKSPACE_MANIFEST_NAME), so the file above is one it never reads.
    const nested = join(root, 'nested');
    mkdirSync(nested);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    writeFileSync(join(nested, 'pnpm-workspaces.yaml'), 'packages:\n  - "*"\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toThrow(
      /should be named "pnpm-workspace.yaml". File found: .*pnpm-workspaces.yaml/
    );
    expect(() => getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toThrow(
      /should be named "pnpm-workspace.yaml"/
    );
  });

  it('reads a correctly named manifest beside a misspelled one', () => {
    // Within a directory pnpm takes the first name that matches, and the real one
    // heads its list.
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    writeFileSync(join(root, 'pnpm-workspace.yml'), 'packages:\n  - "*"\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('counts the dot-prefixed misspellings from 11.0.0, which added them', () => {
    const nested = join(root, 'nested');
    mkdirSync(nested);
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    writeFileSync(join(nested, '.pnpm-workspace.yaml'), 'packages:\n  - "*"\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', nested, '11.0.0')).toThrow(
      /should be named "pnpm-workspace.yaml"/
    );
    // 10.x walks straight past it to the file above.
    expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('fails on a proxy of the wrong shape, the way pnpm dies building its agent', () => {
    writeYaml('proxy:\n  nested: true\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
      /declares a proxy that is not a string/
    );
    writeYaml('httpsProxy:\n  nested: true\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
      /declares an httpsProxy that is not a string/
    );
  });

  it('drops a wrong-shaped noProxy instead of failing, the way pnpm survives it', () => {
    writeYaml(
      'registries:\n  default: https://reg-a.example.com/\nnoProxy:\n  nested: true\n'
    );
    expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
      npm_config_registry: 'https://reg-a.example.com/',
    });
  });

  it('returns nothing below 10.6.0 (registries map not honored by pnpm)', () => {
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, '9.15.9')).toEqual({});
    expect(getPnpmSpawnRegistryEnv('is-even', root, '10.5.0')).toEqual({});
  });

  describe('10.6.0 - 10.x (yaml settings wholesale-replace the npmrc config)', () => {
    it('forces the yaml default registry', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('keeps the yaml default when a scoped package routes elsewhere', () => {
      writeYaml(
        'registries:\n  default: https://reg-a.example.com/\n  "@types": https://reg-e.example.com/\n'
      );
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
      });
    });

    it('bridges only the scoped key when the map has no default', () => {
      // pnpm resolves a scoped package from a scoped-only map fine; it is the
      // unscoped fetch that crashes, so there is no default to reproduce.
      writeYaml('registries:\n  "@types": https://reg-e.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '10.16.0')).toEqual({
        'npm_config_@types:registry': 'https://reg-e.example.com/',
      });
    });

    it('forces both keys to the default for a scoped package without a scoped entry', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_@types:registry': 'https://reg-a.example.com/',
      });
    });

    describe('env references in a yaml settings file', () => {
      it('withholds a proxy holding one from 10.34.5, a release behind the registry', () => {
        process.env.NX_TEST_HOST = 'proxy-env.example.com';
        writeYaml('httpsProxy: http://${NX_TEST_HOST}:8080\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.34.4')).toEqual({
          npm_config_proxy: 'http://proxy-env.example.com:8080',
          npm_config_https_proxy: 'http://proxy-env.example.com:8080',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.34.5')).toEqual({});
      });

      it('keeps a registries entry holding one, which 10.x has no branch for', () => {
        // The withholding reached the scalars alone on this line: the map is a
        // nested value pnpm 10 copies through whole, placeholder and all.
        process.env.NX_TEST_HOST = 'reg-env.example.com';
        writeYaml(
          [
            'registries:',
            '  default: https://${NX_TEST_HOST}/',
            'registry: https://${NX_TEST_HOST}/',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.34.5')).toEqual({
          npm_config_registry: 'https://\\${NX_TEST_HOST}/',
        });
      });

      it('withholds one it cannot resolve rather than aborting, from 10.34.2', () => {
        // The registry is where the backport starts, so the settings beside it
        // survive from there instead of going down with the whole file.
        writeYaml(
          [
            'registry: https://${NX_TEST_UNSET_VAR}/',
            'httpsProxy: http://proxy.example.com:8080',
          ].join('\n')
        );
        expect(() =>
          getPnpmSpawnRegistryEnv('is-even', root, '10.34.1')
        ).toThrow(/references an environment variable that is not set/);
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.34.2')).toEqual({
          npm_config_proxy: 'http://proxy.example.com:8080',
          npm_config_https_proxy: 'http://proxy.example.com:8080',
        });
      });
    });

    it('bridges a workspace .npmrc no-proxy on 10.x too, which npm reads from no file', () => {
      writeFileSync(
        join(root, '.npmrc'),
        'https-proxy=http://proxy.example.com:8080\nno-proxy=internal.example.com'
      );
      // npm resolves https-proxy from the .npmrc itself, but not the http proxy
      // pnpm derives from it (measured on 11.20.0), so that one is bridged.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('leaves a workspace .npmrc noproxy alone on 10.x (npm reads it natively)', () => {
      writeFileSync(join(root, '.npmrc'), 'noproxy=internal.example.com');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({});
    });

    it('drops a whole .npmrc over one unresolvable env reference, the way pnpm below 11 does', () => {
      // Its reader throws on the reference and the config chain catches that per
      // file, so the resolvable key beside it goes down with it. From 11 the
      // lossy reader substitutes an empty string for that one entry and keeps
      // the rest.
      writeFileSync(
        join(root, '.npmrc'),
        'no-proxy=internal.example.com\ncafile=${NX_TEST_HOST}/ca.pem'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({});
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('drops it over an unresolvable reference in a key, which pnpm expands first', () => {
      writeFileSync(
        join(root, '.npmrc'),
        'no-proxy=internal.example.com\n//${NX_TEST_HOST}/:_authToken=secret'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({});
    });

    it('keeps a file whose only unresolvable reference sits in a key[] value', () => {
      // parseField hands an array straight back, so nothing pnpm collected under
      // a repeated key is expanded and none of it can throw.
      writeFileSync(
        join(root, '.npmrc'),
        'no-proxy=internal.example.com\nca[]=${NX_TEST_HOST}'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('keeps the file when every reference resolves, fallbacks included', () => {
      process.env.NX_TEST_HOST = 'internal';
      writeFileSync(
        join(root, '.npmrc'),
        'no-proxy=${NX_TEST_HOST}.example.com'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_noproxy: 'internal.example.com',
      });
      // pnpm resolves a `${VAR-default}` reference to its fallback rather than
      // failing on the unset variable.
      delete process.env.NX_TEST_HOST;
      writeFileSync(
        join(root, '.npmrc'),
        'no-proxy=${NX_TEST_HOST-fallback}.example.com'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_noproxy: 'fallback.example.com',
      });
    });

    it('reports no token helper from a user config pnpm drops that way', () => {
      // pnpm never gets the helper out of the file, so there is no credential
      // npm is missing.
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeUserConfig(
        '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token\ncafile=${NX_TEST_HOST}/ca.pem'
      );
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '10.16.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('bridges nothing for an unscoped package when the map has only scoped entries (pnpm itself crashes here)', () => {
      writeYaml('registries:\n  "@types": https://reg-e.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({});
    });

    it('bridges yaml strictSsl and proxy settings', () => {
      writeYaml(
        [
          'registries:',
          '  default: https://reg-a.example.com/',
          'strictSsl: false',
          'httpsProxy: http://proxy.example.com:8080',
          'noProxy: internal.example.com',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_strict_ssl: 'false',
        // pnpm falls back from httpProxy to httpsProxy, so the one declaration
        // covers an http request too, which npm reads from its own `proxy`.
        npm_config_proxy: 'http://proxy.example.com:8080',
        npm_config_https_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it("bridges a yaml noproxy in npm's own spelling", () => {
      // pnpm answers to both spellings here, unlike its siblings (verified on 11.2.2
      // and 11.9.0: `noproxy` is honored, `httpsproxy` and `https-proxy` ignored).
      // Reading only the camelCase key would send npm through a proxy pnpm bypasses.
      writeYaml(
        [
          'registries:',
          '  default: https://reg-a.example.com/',
          'httpsProxy: http://proxy.example.com:8080',
          'noproxy: internal.example.com',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_proxy: 'http://proxy.example.com:8080',
        npm_config_https_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('prefers a yaml noProxy over noproxy when both are set', () => {
      // pnpm's own precedence (verified on 11.2.2 and 11.9.0).
      writeYaml(
        [
          'registries:',
          '  default: https://reg-a.example.com/',
          'noProxy: camel.example.com',
          'noproxy: lower.example.com',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_noproxy: 'camel.example.com',
      });
    });

    it('does not bridge yaml caFile (dead config in pnpm itself)', () => {
      writeYaml(
        'registries:\n  default: https://reg-a.example.com/\ncaFile: ./ca.pem\n'
      );
      expect(
        getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')
      ).not.toHaveProperty('npm_config_cafile');
    });

    // getAuthHeadersFromConfig reads a tokenHelper from userSettings only. With
    // no auth.ini and no npmrcAuthFile here, that file is npm's own userconfig.
    it('reports a user-config token helper for the registry the yaml sends npm to', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeFileSync(
        join(configHome, 'user.npmrc'),
        '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
      );
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '10.16.0');
      });
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
        '//reg-a.example.com/'
      );
    });

    it("resolves the proxy pair across npm's user config before deriving one", () => {
      // pnpm's config on this line is npm-conf shaped, so the user .npmrc is one
      // of its tiers. An https-proxy there is what a legacy `proxy` above it
      // leaves undeclared, and deriving without it would overwrite npm's own.
      writeUserConfig('https-proxy=http://user-proxy.example.com:8080');
      writeFileSync(
        join(root, '.npmrc'),
        'proxy=http://project-proxy.example.com:8080'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_proxy: 'http://user-proxy.example.com:8080',
      });
    });

    it('pins an unscoped helper to the registry that wins overall', () => {
      // getAuthHeadersFromConfig keys it on allSettings.registry, so the yaml
      // default carries it even though the user config names no registry. 11
      // pins the same line to the declaring file instead.
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeFileSync(
        join(configHome, 'user.npmrc'),
        'tokenHelper=/usr/local/bin/get-token'
      );
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '10.16.0');
      });
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
        '//reg-a.example.com/'
      );
    });

    it('ignores the 11-only auth-file selection when picking that config', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      const path = join(configHome, 'pnpm-only.npmrc');
      writeFileSync(
        path,
        '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
      );
      process.env.PNPM_CONFIG_NPMRC_AUTH_FILE = path;
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '10.16.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('counts an ambient credential npm keeps on this line', () => {
      // pnpm 10.x reads npm_config_*, so the spawn keeps this token and npm
      // authenticates with it. On 11.0-11.5 it is dropped and the helper is reported.
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeUserConfig(
        '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
      );
      process.env['npm_config_//reg-a.example.com/:_authToken'] = 'env-token';
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '10.16.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    describe('nested under another workspace', () => {
      let nested: string;

      beforeEach(() => {
        nested = join(root, 'nested');
        mkdirSync(nested);
      });

      function writeNestedNpmrc(contents: string): void {
        writeFileSync(join(nested, '.npmrc'), contents);
      }
      function writeAncestorNpmrc(contents: string): void {
        writeFileSync(join(root, '.npmrc'), contents);
      }

      it('bridges the ancestor .npmrc, which the spawned npm has no tier for', () => {
        // The credential belongs to the registry the ancestor yaml sends npm to,
        // so bridging one without the other authenticates nowhere.
        writeYaml(
          'packages:\n  - "nested"\nregistries:\n  default: https://reg-outer.example.com/\n'
        );
        writeAncestorNpmrc(
          '//reg-outer.example.com/:_authToken=outer-token\n//reg-b.example.com/:_authToken=other-token'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_registry: 'https://reg-outer.example.com/',
          'npm_config_//reg-outer.example.com/:_authToken': 'outer-token',
          'npm_config_//reg-b.example.com/:_authToken': 'other-token',
        });
      });

      it('bridges nothing when the workspace is its own root, where npm reads that file', () => {
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc(
          'registry=https://reg-a.example.com/\n//reg-a.example.com/:_authToken=token'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({});
      });

      it('lets the nested .npmrc shadow the ancestor one, which pnpm ranks below it', () => {
        // Injecting the ancestor value would put it at npm's env tier, above the
        // file npm reads for itself, inverting pnpm's own order. An emptied value
        // shadows the same way, which is how a project clears what it inherits.
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc('registry=https://reg-outer.example.com/');
        writeNestedNpmrc('registry=https://reg-nested.example.com/');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual(
          {}
        );
        writeNestedNpmrc('registry=');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual(
          {}
        );
      });

      it('leaves a setting the ambient environment declares, which pnpm reads on this line', () => {
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc('registry=https://reg-outer.example.com/');
        process.env.npm_config_registry = 'https://reg-env.example.com/';
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual(
          {}
        );
      });

      it('keeps the yaml registry above the ancestor .npmrc, which pnpm assigns it over', () => {
        writeYaml(
          'packages:\n  - "nested"\nregistries:\n  default: https://reg-yaml.example.com/\n'
        );
        writeAncestorNpmrc('registry=https://reg-outer.example.com/');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_registry: 'https://reg-yaml.example.com/',
        });
      });

      it('keeps the yaml network settings above the ancestor .npmrc ones', () => {
        writeYaml(
          [
            'packages:',
            '  - "nested"',
            'strictSsl: true',
            'httpsProxy: http://yaml-proxy.example.com:8080',
            'noProxy: yaml.example.com',
          ].join('\n')
        );
        writeAncestorNpmrc(
          [
            'strict-ssl=false',
            'https-proxy=http://npmrc-proxy.example.com:8080',
            'no-proxy=npmrc.example.com',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_strict_ssl: 'true',
          npm_config_proxy: 'http://yaml-proxy.example.com:8080',
          npm_config_https_proxy: 'http://yaml-proxy.example.com:8080',
          npm_config_noproxy: 'yaml.example.com',
        });
      });

      it("bridges the ancestor file's TLS and proxy settings", () => {
        // pnpm reads a relative cafile with a bare readFileSync on this line, so
        // it lands on the directory the command runs in and not on the ancestor's.
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc(
          [
            'cafile=./ca.pem',
            'strict-ssl=false',
            'https-proxy=http://proxy.example.com:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_cafile: join(nested, 'ca.pem'),
          npm_config_strict_ssl: 'false',
          npm_config_proxy: 'http://proxy.example.com:8080',
          npm_config_https_proxy: 'http://proxy.example.com:8080',
        });
      });

      it("bridges an ancestor noproxy, which pnpm honors in npm's own spelling too", () => {
        // Measured on 10.18.0: with an https-proxy set, either spelling sends the
        // fetch direct. npm reads `noproxy` natively, but only out of its own
        // project config, so the ancestor's still has to be carried across.
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc('noproxy=internal.example.com');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_noproxy: 'internal.example.com',
        });
        // pnpm prefers `no-proxy` across every layer over `noproxy` across every
        // layer, so the nested file's spelling wins here.
        writeNestedNpmrc('no-proxy=nested.example.com');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_noproxy: 'nested.example.com',
        });
      });

      it('leaves an ancestor noproxy the nested .npmrc already declares', () => {
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc('noproxy=outer.example.com');
        writeNestedNpmrc('noproxy=nested.example.com');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual(
          {}
        );
      });

      it('falls through to the ancestor no-proxy, and lets an emptied nested one clear it', () => {
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc('no-proxy=internal.example.com');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_noproxy: 'internal.example.com',
        });
        writeNestedNpmrc('no-proxy=');
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual(
          {}
        );
      });

      it('lets the ancestor through when pnpm discarded the nested .npmrc', () => {
        // A file pnpm dropped whole shadows nothing in pnpm, even though npm
        // goes on reading that same file for itself.
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc(
          'registry=https://reg-outer.example.com/\n//reg-outer.example.com/:_authToken=outer-token'
        );
        writeNestedNpmrc(
          'registry=https://reg-nested.example.com/\ncafile=${NX_TEST_HOST}/ca.pem'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_registry: 'https://reg-outer.example.com/',
          'npm_config_//reg-outer.example.com/:_authToken': 'outer-token',
        });
      });

      it('bridges a registry-scoped certfile but neither inline PEM nor a bare credential', () => {
        // pnpm pairs a registry with `:certfile`/`:keyfile` paths, the same keys
        // npm resolves per URI; scoped inline PEM is dead config in both. A bare
        // credential pnpm pins to the registry its npmrc chain resolves, which is
        // not the one the yaml sends the fetch to, so npm is given no dart for it.
        writeYaml(
          'packages:\n  - "nested"\nregistries:\n  default: https://reg-outer.example.com/\n'
        );
        writeAncestorNpmrc(
          [
            '//reg-outer.example.com/:certfile=/etc/ssl/client.pem',
            '//reg-outer.example.com/:cert=-----BEGIN CERTIFICATE-----',
            '_authToken=bare-token',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', nested, '10.16.0')).toEqual({
          npm_config_registry: 'https://reg-outer.example.com/',
          'npm_config_//reg-outer.example.com/:certfile': '/etc/ssl/client.pem',
        });
      });

      it('bridges the scoped registry the ancestor declares for the package', () => {
        writeYaml('packages:\n  - "nested"\n');
        writeAncestorNpmrc('@types:registry=https://reg-scoped.example.com/');
        expect(
          getPnpmSpawnRegistryEnv('@types/node', nested, '10.16.0')
        ).toEqual({
          'npm_config_@types:registry': 'https://reg-scoped.example.com/',
        });
      });
    });
  });

  describe('>= 11.0.0 (per-key merge, pnpm_config_* env, auth.ini)', () => {
    it('bridges the yaml default registry', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('bridges only the scoped key when the map has only a scoped entry (npmrc default still applies)', () => {
      writeYaml('registries:\n  "@types": https://reg-e.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '11.5.0')).toEqual({
        'npm_config_@types:registry': 'https://reg-e.example.com/',
      });
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('does not force the scoped key from the yaml default (npmrc @scope:registry beats yaml default in pnpm 11)', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('pnpm_config_registry env beats the yaml default', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      process.env.pnpm_config_registry = 'https://reg-c.example.com/';
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-c.example.com/',
      });
    });

    it('pnpm_config_registry env does not override a yaml scoped entry', () => {
      writeYaml('registries:\n  "@types": https://reg-e.example.com/\n');
      process.env.pnpm_config_registry = 'https://reg-c.example.com/';
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-c.example.com/',
        'npm_config_@types:registry': 'https://reg-e.example.com/',
      });
    });

    it('bridges registry and nerf-darted auth from auth.ini', () => {
      writeAuthIni(
        [
          'registry=https://reg-g.example.com/',
          '//reg-g.example.com/:_authToken=secret',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-g.example.com/',
        'npm_config_//reg-g.example.com/:_authToken': 'secret',
      });
    });

    it('expands ${VAR} references in auth.ini values before bridging', () => {
      process.env.NX_TEST_NPM_TOKEN = 'real-token';
      try {
        writeAuthIni(
          [
            'registry=https://reg-g.example.com/',
            '//reg-g.example.com/:_authToken=${NX_TEST_NPM_TOKEN}',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-g.example.com/',
          'npm_config_//reg-g.example.com/:_authToken': 'real-token',
        });
      } finally {
        delete process.env.NX_TEST_NPM_TOKEN;
      }
    });

    it('honors pnpm ${VAR:-default} syntax in auth.ini values', () => {
      // pnpm reads auth.ini with its own env grammar, which npm's does not
      // share: npm would treat the whole token as one unknown variable name.
      delete process.env.NX_TEST_UNSET_REGISTRY;
      writeAuthIni(
        'registry=${NX_TEST_UNSET_REGISTRY:-https://reg-d.example.com/}'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-d.example.com/',
      });
    });

    it('drops an auth.ini value whose ${VAR} cannot be resolved', () => {
      // Bridging the reference verbatim would send a literal ${VAR} as the
      // credential; pnpm substitutes an empty string here.
      delete process.env.NX_TEST_UNSET_TOKEN;
      writeAuthIni(
        [
          'registry=https://reg-g.example.com/',
          '//reg-g.example.com/:_authToken=${NX_TEST_UNSET_TOKEN}',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-g.example.com/',
        'npm_config_//reg-g.example.com/:_authToken': '',
      });
    });

    it('expands ${VAR} references in auth.ini keys the way pnpm does', () => {
      process.env.NX_TEST_HOST = 'reg-a.example.com';
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//${NX_TEST_HOST}/:_authToken=host-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'host-token',
      });
    });

    it('lets a later auth.ini key win over an earlier one that expands to it', () => {
      process.env.NX_TEST_HOST = 'reg-a.example.com';
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//${NX_TEST_HOST}/:_authToken=expanded-first',
          '//reg-a.example.com/:_authToken=literal-last',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'literal-last',
      });
    });

    it('leaves an ambient credential ahead of an auth.ini key spelled through ${VAR}', () => {
      process.env.NX_TEST_HOST = 'reg-a.example.com';
      process.env['npm_config_//reg-a.example.com/:_authToken'] = 'ambient';
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//${NX_TEST_HOST}/:_authToken=file-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('bridges an auth.ini scoped registry declared through a ${VAR} key', () => {
      process.env.NX_TEST_SCOPE = 'myscope';
      writeAuthIni('@${NX_TEST_SCOPE}:registry=https://reg-c.example.com/');
      expect(
        getPnpmSpawnRegistryEnv('@myscope/is-even', root, '11.5.0')
      ).toEqual({
        'npm_config_@myscope:registry': 'https://reg-c.example.com/',
      });
    });

    it('keeps pnpm lossy semantics for a key whose ${VAR} cannot be resolved', () => {
      // pnpm substitutes an empty string for the unresolved reference, so the
      // key degrades to `///:_authToken` rather than staying literal the way
      // npm's own grammar would keep it.
      delete process.env.NX_TEST_UNSET_HOST;
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//${NX_TEST_UNSET_HOST}/:_authToken=orphan',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_///:_authToken': 'orphan',
      });
    });

    it('treats a registry that expanded to nothing as unset', () => {
      // npm skips an empty env value, and pnpm re-checks for an empty registry,
      // so neither reads one as a destination.
      delete process.env.NX_TEST_UNSET_REGISTRY;
      writeAuthIni('registry=${NX_TEST_UNSET_REGISTRY}');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('treats a cafile that expanded to nothing as unset', () => {
      // An empty cafile would otherwise resolve to auth.ini's own directory,
      // handing npm a directory where it expects a certificate file.
      delete process.env.NX_TEST_UNSET_CA;
      writeAuthIni('cafile=${NX_TEST_UNSET_CA}');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('re-keys a bare auth.ini _authToken onto the default registry', () => {
      writeAuthIni('_authToken=bare-secret');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        'npm_config_//registry.npmjs.org/:_authToken': 'bare-secret',
      });
    });

    it('re-keys a bare auth.ini _auth onto the registry auth.ini declares', () => {
      writeAuthIni(
        ['registry=https://reg-a.example.com/', '_auth=YmFzZTY0'].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_auth': 'YmFzZTY0',
      });
    });

    it('does not let a workspace .npmrc registry claim a bare auth.ini token', () => {
      // pnpm pins an unscoped credential to the registry of the file that
      // declares it, so a workspace-local registry cannot pull a user-level
      // token to a host of its choosing (CVE-2026-50017).
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-b.example.com/'
      );
      writeAuthIni('_authToken=ini-token');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        'npm_config_//registry.npmjs.org/:_authToken': 'ini-token',
      });
    });

    it('leaves a workspace .npmrc credential ahead of a bare auth.ini one', () => {
      // The re-key lands at npm's env tier, which outranks the file npm reads for
      // itself, so bridging it would displace the workspace credential pnpm prefers.
      writeFileSync(
        join(root, '.npmrc'),
        '//reg-a.example.com/:_authToken=project-token'
      );
      writeAuthIni(
        ['registry=https://reg-a.example.com/', '_authToken=ini-token'].join(
          '\n'
        )
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('lets a ${VAR}-keyed workspace .npmrc credential outrank auth.ini before 11.5.3', () => {
      // Until 11.5.3 pnpm expands `${VAR}` in workspace .npmrc keys, so the
      // project credential is what pnpm sends, and bridging auth.ini's would
      // displace it at npm's env tier (verified against pnpm 11.5.2).
      process.env.NX_TEST_HOST = 'reg-a.example.com';
      writeFileSync(
        join(root, '.npmrc'),
        '//${NX_TEST_HOST}/:_authToken=project-token'
      );
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=ini-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.2')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('bridges auth.ini over a ${VAR}-keyed workspace entry from 11.5.3, which pnpm drops', () => {
      // From 11.5.3 pnpm refuses to expand `${VAR}` in workspace .npmrc auth and
      // registry keys and drops the entry with a warning, so auth.ini is what
      // pnpm resolves there (verified against pnpm 11.5.3).
      process.env.NX_TEST_HOST = 'reg-a.example.com';
      writeFileSync(
        join(root, '.npmrc'),
        '//${NX_TEST_HOST}/:_authToken=project-token'
      );
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=ini-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.3')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
      });
    });

    it('reads the workspace .npmrc beside the ancestor workspace file, not the nested one', () => {
      // From 11 pnpm reads a single project .npmrc, and it sits beside the
      // workspace file it walked up to (loadNpmrcConfig's workspaceDir). Reading
      // the nested one instead lets a registry pnpm never saw suppress the
      // auth.ini registry it does resolve, leaving npm on a different host with
      // the credential withheld.
      const nested = join(root, 'nested');
      mkdirSync(nested);
      writeYaml('packages:\n  - "nested"\n');
      writeFileSync(join(root, '.npmrc'), '; declares no registry');
      writeFileSync(
        join(nested, '.npmrc'),
        'registry=https://reg-nested.example.com/'
      );
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=ini-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
      });
    });

    it('bridges the ancestor workspace .npmrc, which the spawned npm cannot read', () => {
      // npm resolves its project config from the directory the spawn runs in, so
      // a workspace .npmrc above that directory reaches pnpm and nothing else.
      // Injecting the yaml registry without it would aim npm at a host it holds
      // no credential for.
      const nested = join(root, 'nested');
      mkdirSync(nested);
      writeYaml(
        'packages:\n  - "nested"\nregistries:\n  default: https://reg-outer.example.com/\n'
      );
      writeFileSync(
        join(root, '.npmrc'),
        '//reg-outer.example.com/:_authToken=outer-token'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-outer.example.com/',
        'npm_config_//reg-outer.example.com/:_authToken': 'outer-token',
      });
    });

    it('lets the ancestor workspace .npmrc outrank auth.ini, the way pnpm merges them', () => {
      const nested = join(root, 'nested');
      mkdirSync(nested);
      writeYaml('packages:\n  - "nested"\n');
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-outer.example.com/'
      );
      writeAuthIni('registry=https://reg-a.example.com/');
      expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-outer.example.com/',
      });
    });

    it('rescopes a bare ancestor workspace credential onto that file own registry', () => {
      // rescopeUnscopedCreds runs per file, so the pin follows the registry the
      // declaring file carries rather than whichever one wins overall.
      const nested = join(root, 'nested');
      mkdirSync(nested);
      writeYaml('packages:\n  - "nested"\n');
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-outer.example.com/',
          '_authToken=outer-token',
        ].join('\n')
      );
      writeAuthIni(
        ['registry=https://reg-a.example.com/', '_authToken=ini-token'].join(
          '\n'
        )
      );
      expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-outer.example.com/',
        'npm_config_//reg-outer.example.com/:_authToken': 'outer-token',
        'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
      });
    });

    it('lets an emptied ancestor credential clear the one auth.ini declares', () => {
      // pnpm re-keys a bare credential onto its registry whether or not it has a
      // value, so an emptied one shadows the same key below it. Dropping it here
      // would send npm a credential the workspace deliberately cleared.
      const nested = join(root, 'nested');
      mkdirSync(nested);
      writeYaml('packages:\n  - "nested"\n');
      writeFileSync(join(root, '.npmrc'), '_authToken=');
      writeAuthIni('_authToken=ini-token');
      expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
        'npm_config_//registry.npmjs.org/:_authToken': '',
      });
    });

    it('takes a URL-scoped env certificate over the one a file declares', () => {
      // The env tier outranks both files in pnpm, and npm reads inline PEM only
      // as the flat key, so the scoped env entry has to be the one re-spelled.
      process.env['pnpm_config_//reg-a.example.com/:cert'] = 'ENV-CERT';
      writeAuthIni(
        ['registry=https://reg-a.example.com/', 'cert=FILE-CERT'].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:cert': 'ENV-CERT',
        npm_config_cert: 'ENV-CERT',
      });
    });

    it('cancels a project certificate pinned to a registry the fetch never reaches', () => {
      // pnpm pins an inline pair to the registry its own file declares, so a
      // scoped fetch elsewhere goes without one. npm reads the same pair out of
      // the file itself and would present it to whatever host it contacts.
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-a.example.com/',
          '@acme:registry=https://reg-b.example.com/',
          'cert=A-CERT',
          'key=A-KEY',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('@acme/pkg', root, '11.6.0')).toEqual({
        npm_config_cert: 'null',
        npm_config_key: 'null',
      });
      // The unscoped fetch does reach the registry they are pinned to.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
        npm_config_cert: 'A-CERT',
        npm_config_key: 'A-KEY',
      });
    });

    it('cancels one npm only resolves through an expanded key', () => {
      // npm expands a `${VAR}` in the key before looking the setting up, so a
      // placeholder-spelled pair reaches it just the same and needs cancelling.
      process.env.NX_TEST_TLS_KEY = 'cert';
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-a.example.com/',
          '@acme:registry=https://reg-b.example.com/',
          '${NX_TEST_TLS_KEY}=A-CERT',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('@acme/pkg', root, '11.6.0')).toEqual({
        npm_config_cert: 'null',
      });
    });

    it('takes an ambient URL-scoped certificate the spawn keeps from 11.6.0 on', () => {
      process.env['npm_config_//reg-a.example.com/:cert'] = 'AMBIENT-CERT';
      writeAuthIni(
        ['registry=https://reg-a.example.com/', 'cert=FILE-CERT'].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cert: 'AMBIENT-CERT',
      });
    });

    it('takes the client certificate pinned to the contacted registry, not the highest one', () => {
      // pnpm pins inline cert/key to the declaring file's own registry before it
      // merges, so a lower file's pair is the live one whenever its registry is
      // the one being contacted. Picking by precedence instead would present a
      // certificate for the wrong host, or withhold one and fail the handshake.
      const nested = join(root, 'nested');
      mkdirSync(nested);
      writeYaml('packages:\n  - "nested"\n');
      // Declares no registry, so its pair pins to npmjs and auth.ini's registry
      // is the one npm contacts.
      writeFileSync(
        join(root, '.npmrc'),
        ['cert=OUTER-CERT', 'key=OUTER-KEY'].join('\n')
      );
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          'cert=A-CERT',
          'key=A-KEY',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', nested, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cert: 'A-CERT',
        npm_config_key: 'A-KEY',
      });
    });

    it('lets a ${VAR}-valued workspace registry outrank auth.ini before 11.5.3', () => {
      // The value half of the same rule: until 11.5.3 pnpm expands `${VAR}` in
      // the value too, so the project registry is the one pnpm resolves and
      // auth.ini's stays where pnpm leaves it (verified against pnpm 11.5.2).
      process.env.NX_TEST_HOST = 'reg-b.example.com';
      writeFileSync(join(root, '.npmrc'), 'registry=https://${NX_TEST_HOST}/');
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=ini-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.2')).toEqual({
        'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
      });
    });

    it('bridges auth.ini over a ${VAR}-valued workspace registry from 11.5.3, which pnpm drops', () => {
      // From 11.5.3 pnpm drops a registry, proxy or credential entry whose value
      // holds a `${VAR}` rather than expanding it, so auth.ini's registry is what
      // it resolves. npm expands the same value and would otherwise send the
      // request to a host pnpm never picked (verified against pnpm 11.5.3).
      process.env.NX_TEST_HOST = 'reg-b.example.com';
      writeFileSync(join(root, '.npmrc'), 'registry=https://${NX_TEST_HOST}/');
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=ini-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.3')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
      });
    });

    it('bridges an auth.ini credential over a ${VAR}-valued workspace one from 11.5.3', () => {
      // Same drop on the credential side, where the cost is an unauthenticated
      // request rather than a redirected one.
      process.env.NX_TEST_TOKEN = 'project-token';
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=${NX_TEST_TOKEN}',
        ].join('\n')
      );
      writeAuthIni('//reg-a.example.com/:_authToken=ini-token');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.3')).toEqual({
        'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
      });
    });

    it('warns once when a bare auth.ini credential cannot reach the contacted registry', () => {
      // Nothing in npm's own error ties the missing credential back to auth.ini.
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-b.example.com/'
      );
      writeAuthIni('_authToken=ini-token');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
        fresh('is-odd', root, '11.5.0');
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
        '//reg-b.example.com/'
      );
    });

    it('names the registry without the credentials embedded in its url', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://alice:s3cr3t@reg-b.example.com/'
      );
      writeAuthIni('_authToken=ini-token');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      const message = (logger.warn as jest.Mock).mock.calls[0][0];
      expect(message).toContain('//reg-b.example.com/');
      expect(message).not.toContain('s3cr3t');
    });

    it('stays quiet when the workspace .npmrc already authenticates that registry', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-b.example.com/',
          '//reg-b.example.com/:_authToken=project-token',
        ].join('\n')
      );
      writeAuthIni('_authToken=ini-token');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stays quiet when a parent registry path carries the credential', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-b.example.com/npm/',
          '//reg-b.example.com/:_authToken=project-token',
        ].join('\n')
      );
      writeAuthIni('_authToken=ini-token');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not count an ambient credential the spawn strips on 11.0-11.5', () => {
      // This pnpm line ignores npm_config_* entirely, so the spawn drops this ambient
      // token (mergeNpmConfigEnv) before npm runs. npm then fetches reg-b with no
      // credential, so the auth.ini bare token pinned to npmjs is still missing.
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      process.env['npm_config_//reg-b.example.com/:_authToken'] = 'env-token';
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-b.example.com/'
      );
      writeAuthIni('_authToken=ini-token');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('still warns when the credential npm would find is incomplete', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-b.example.com/',
          '//reg-b.example.com/:username=alice',
        ].join('\n')
      );
      writeAuthIni('_authToken=ini-token');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('names the keys that are actually unscoped in the remediation', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-b.example.com/'
      );
      writeAuthIni(['username=alice', '_password=cGFzcw=='].join('\n'));
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      const message = (logger.warn as jest.Mock).mock.calls[0][0];
      expect(message).toContain('"//reg-b.example.com/:username=..."');
      expect(message).toContain('"//reg-b.example.com/:_password=..."');
      expect(message).not.toContain('_authToken');
    });

    it('stays quiet when the bare credential expanded to nothing', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      delete process.env.NX_TEST_UNSET_TOKEN;
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-b.example.com/'
      );
      writeAuthIni('_authToken=${NX_TEST_UNSET_TOKEN}');
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stays quiet when the bare auth.ini credential reaches its registry', () => {
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      writeAuthIni(
        ['registry=https://reg-a.example.com/', '_authToken=ini-token'].join(
          '\n'
        )
      );
      jest.isolateModules(() => {
        const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
        fresh('is-even', root, '11.5.0');
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not let a yaml registry claim a bare auth.ini token', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeAuthIni('_authToken=ini-token');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//registry.npmjs.org/:_authToken': 'ini-token',
      });
    });

    it('does not re-key a bare workspace .npmrc auth entry', () => {
      // npm reads the workspace .npmrc itself and rejects bare auth there.
      writeFileSync(join(root, '.npmrc'), '_authToken=project-token');
      writeAuthIni('registry=https://reg-g.example.com/');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-g.example.com/',
      });
    });

    it('lets the workspace .npmrc beat auth.ini (pnpm layer order)', () => {
      writeFileSync(
        join(root, '.npmrc'),
        [
          'registry=https://reg-b.example.com/',
          '//reg-g.example.com/:_authToken=project-secret',
        ].join('\n')
      );
      writeAuthIni(
        [
          'registry=https://reg-g.example.com/',
          '//reg-g.example.com/:_authToken=secret',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('yaml default beats auth.ini registry', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeAuthIni('registry=https://reg-g.example.com/');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
    });

    it('bridges a scoped registry from auth.ini', () => {
      writeAuthIni('@types:registry=https://reg-x.example.com/');
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '11.5.0')).toEqual({
        'npm_config_@types:registry': 'https://reg-x.example.com/',
      });
    });

    it('lets the workspace .npmrc beat an auth.ini scoped registry', () => {
      writeFileSync(
        join(root, '.npmrc'),
        '@types:registry=https://reg-proj.example.com/'
      );
      writeAuthIni('@types:registry=https://reg-x.example.com/');
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '11.5.0')).toEqual(
        {}
      );
    });

    it('resolves an auth.ini cafile against the workspace root below 11.2.0', () => {
      // Before 11.2.0 the only reader is loadCAFile, a bare readFileSync on the raw
      // value, so the path is cwd-relative. npm ignores a cafile it cannot open, so
      // the wrong base drops the trust anchor with no diagnostic.
      writeAuthIni('cafile=./ca.pem');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.1.0')).toEqual({
        npm_config_cafile: join(root, 'ca.pem'),
      });
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.2.0')).toEqual({
        npm_config_cafile: join(configHome, 'pnpm', 'ca.pem'),
      });
    });

    it('bridges flat TLS/proxy keys from auth.ini (cafile resolved against auth.ini)', () => {
      writeAuthIni(
        [
          'cafile=./ca.pem',
          'strict-ssl=false',
          'https-proxy=http://proxy.example.com:8443',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cafile: join(configHome, 'pnpm', 'ca.pem'),
        npm_config_strict_ssl: 'false',
        npm_config_proxy: 'http://proxy.example.com:8443',
        npm_config_https_proxy: 'http://proxy.example.com:8443',
      });
    });

    it.each(['0', 'no', 'off', '', 'null'])(
      'keeps TLS verification on for an auth.ini strict-ssl of %p',
      (value) => {
        // parseField types strict-ssl Boolean-only, so none of these parse to
        // false in pnpm; bridging them as false would silently disable TLS.
        writeAuthIni(`strict-ssl=${value}`);
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_strict_ssl: 'true',
        });
      }
    );

    it('keeps TLS verification on for an auth.ini strict-ssl read from an env var', () => {
      // parseField expands ${VAR} only after the true/false check, so an
      // expanded 'false' stays a truthy string in pnpm.
      process.env.NX_TEST_STRICT_SSL = 'false';
      try {
        writeAuthIni('strict-ssl=${NX_TEST_STRICT_SSL}');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_strict_ssl: 'true',
        });
      } finally {
        delete process.env.NX_TEST_STRICT_SSL;
      }
    });

    it('escapes what a reference expanded to, so npm does not expand it again', () => {
      // pnpm substitutes once and sends the result; npm runs its own pass over
      // every value it receives, which would resolve a `${VAR}` the variable's
      // own value carries.
      process.env.NX_TEST_TOKEN = 'ab${NX_TEST_HOST}cd';
      process.env.NX_TEST_HOST = 'leaked';
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          '//reg-a.example.com/:_authToken=${NX_TEST_TOKEN}',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'ab\\${NX_TEST_HOST}cd',
      });
    });

    it('darts a bare credential onto the registry pnpm resolved, not its escaped form', () => {
      // The bridged registry is text for npm to expand, where `\` is a path
      // separator to the URL parser: darting that instead keys the credential a
      // segment off and npm sends the request unauthenticated.
      process.env.NX_TEST_HOST = 'https://reg-a.example.com/${LITERAL}/';
      writeAuthIni(
        ['registry=${NX_TEST_HOST}', '_authToken=ini-token'].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/\\${LITERAL}/',
        'npm_config_//reg-a.example.com/$%7BLITERAL%7D/:_authToken':
          'ini-token',
      });
    });

    it('keys a credential the way pnpm reads an escaped reference in the key', () => {
      // pnpm consumes the escape on both halves, so its dart and its registry
      // agree. npm expands the value but not the key, so a key left escaped
      // matches no registry and the request goes out unauthenticated.
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/\\${LITERAL}/',
          '//reg-a.example.com/\\${LITERAL}/:_authToken=ini-token',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/\\${LITERAL}/',
        'npm_config_//reg-a.example.com/${LITERAL}/:_authToken': 'ini-token',
      });
    });

    it('escapes a cafile path, so npm opens the file pnpm resolved', () => {
      // Only the escaping is observable here. That it happens after the path is
      // resolved matters on Windows alone, where the backslashes it adds are
      // separators that normalization would collapse.
      process.env.NX_TEST_TOKEN = 'certs/${LITERAL}/ca.pem';
      writeAuthIni('cafile=${NX_TEST_TOKEN}');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cafile: join(
          configHome,
          'pnpm',
          'certs/\\${LITERAL}/ca.pem'
        ),
      });
    });

    it('escapes a JSON auth token, which pnpm never expands at all', () => {
      process.env.NX_TEST_HOST = 'leaked';
      process.env.pnpm_config__auth = JSON.stringify({
        'https://reg-a.example.com/': {
          '@': { authToken: 'ab${NX_TEST_HOST}cd' },
        },
      });
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        'npm_config_//reg-a.example.com/:_authToken': 'ab\\${NX_TEST_HOST}cd',
      });
    });

    it('bridges flat ca/cert/key from auth.ini (npm has no inline scoped form)', () => {
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          'cert=CERTPEM',
          'key=KEYPEM',
          'ca=CAPEM',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
        npm_config_ca: 'CAPEM',
      });
    });

    it('drops auth.ini cert/key when another registry will be contacted', () => {
      // npm_config_cert/key present the client certificate to every host it
      // contacts, and pnpm pins them to the declaring file's registry. The trust
      // anchor in `ca` is not source-scoped, so it still bridges.
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM', 'ca=CAPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_ca: 'CAPEM',
      });
    });

    it('drops auth.ini cert/key when the workspace .npmrc redirects the request', () => {
      // The .npmrc registry never lands in the env (npm reads it natively), so
      // the comparison has to read the file to see the redirection.
      writeFileSync(
        join(root, '.npmrc'),
        'registry=https://reg-b.example.com/'
      );
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('ignores an ambient npm registry on >= 11 and keeps cert/key at the default', () => {
      // pnpm >= 11 ignores npm_config_*, so the spawn drops this ambient registry
      // (mergeNpmConfigEnv) and npm falls back to its default, which is the registry
      // these client-cert halves are pinned to.
      process.env.NPM_CONFIG_REGISTRY = 'https://reg-b.example.com/';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
      });
    });

    it('bridges auth.ini cert/key when the overlay overrides the ambient registry', () => {
      process.env.NPM_CONFIG_REGISTRY = 'https://reg-b.example.com/';
      writeAuthIni(
        [
          'registry=https://reg-a.example.com/',
          'cert=CERTPEM',
          'key=KEYPEM',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
      });
    });

    it('keeps a ~/ auth.ini cafile literal (pnpm does not expand it)', () => {
      writeAuthIni('cafile=~/certs/ca.pem');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cafile: join(configHome, 'pnpm', '~/certs/ca.pem'),
      });
    });

    // npm knows only `noproxy` and warns about `no-proxy` as an unknown config, so
    // whichever layer pnpm takes the bypass list from has to be re-spelled.
    it('bridges an npmrc http-proxy, which npm reads under no key of its own', () => {
      writeAuthIni('http-proxy=http://proxy.example.com:8080');
      writeYaml('registries:\n  default: http://reg-a.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'http://reg-a.example.com/',
        npm_config_proxy: 'http://proxy.example.com:8080',
      });
    });

    it("bridges an auth.ini no-proxy under npm's noproxy spelling", () => {
      writeAuthIni(
        [
          'https-proxy=http://proxy.example.com:8080',
          'no-proxy=internal.example.com',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_proxy: 'http://proxy.example.com:8080',
        npm_config_https_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('bridges a workspace .npmrc no-proxy, which npm reads from no file', () => {
      writeFileSync(
        join(root, '.npmrc'),
        [
          'https-proxy=http://proxy.example.com:8080',
          'no-proxy=internal.example.com',
        ].join('\n')
      );
      // npm resolves https-proxy from the .npmrc itself, but not the http proxy
      // pnpm derives from it, so that one is bridged beside the bypass list.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('prefers the workspace .npmrc no-proxy over the auth.ini one', () => {
      writeAuthIni('no-proxy=ini.example.com');
      writeFileSync(join(root, '.npmrc'), 'no-proxy=project.example.com');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_noproxy: 'project.example.com',
      });
    });

    it('lets an empty workspace .npmrc no-proxy clear the auth.ini one', () => {
      writeAuthIni('no-proxy=ini.example.com');
      writeFileSync(join(root, '.npmrc'), 'no-proxy=');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('leaves an auth.ini noproxy alone (pnpm 11 ignores that spelling)', () => {
      writeAuthIni('noproxy=ini.example.com');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('falls through to the auth.ini no-proxy when the workspace .npmrc cannot be read', () => {
      writeAuthIni('no-proxy=ini.example.com');
      mkdirSync(join(root, '.npmrc'));
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_noproxy: 'ini.example.com',
      });
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
        'Could not read'
      );
    });

    it('keeps bridging the auth.ini registry and TLS mode when the workspace .npmrc cannot be read', () => {
      // pnpm keeps resolving from the remaining layers for an .npmrc it cannot read,
      // so an unreadable file must not collapse the bridge into npm's own resolution.
      writeAuthIni(
        ['registry=https://reg-a.example.com/', 'strict-ssl=false'].join('\n')
      );
      mkdirSync(join(root, '.npmrc'));
      const { logger } = require('../logger');
      (logger.warn as jest.Mock).mockClear();
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_strict_ssl: 'false',
      });
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
        'Could not read'
      );
    });

    it('expands a no-proxy env reference with pnpm grammar', () => {
      process.env.PNPM_TEST_NOPROXY = 'internal.example.com';
      writeAuthIni(
        'no-proxy=${PNPM_TEST_NOPROXY},${PNPM_TEST_UNSET:-fallback.example.com}'
      );
      // npm leaves the `:-` default form verbatim, so only pnpm's expander
      // produces this.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_noproxy: 'internal.example.com,fallback.example.com',
      });
    });

    describe('URL-scoped env tier (>= 11.6.0)', () => {
      // 11.6.0 added readUrlScopedEnvConfig: `p?npm_config_//<dart>:<key>` entries are
      // read from the environment again.
      it('re-spells a pnpm_config_ URL-scoped credential onto the overlay', () => {
        process.env['pnpm_config_//reg-a.example.com/:_authToken'] =
          'pnpm-env-token';
        // The prefix matches case-insensitively; the dart keeps its case.
        process.env['PNPM_CONFIG_//reg-b.example.com/:_authToken'] =
          'pnpm-env-token-b';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
          'npm_config_//reg-a.example.com/:_authToken': 'pnpm-env-token',
          'npm_config_//reg-b.example.com/:_authToken': 'pnpm-env-token-b',
        });
      });

      it('does not read the tier before 11.6.0', () => {
        process.env['pnpm_config_//reg-a.example.com/:_authToken'] =
          'pnpm-env-token';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
      });

      it('skips a tokenHelper and an empty value the way pnpm does', () => {
        process.env['pnpm_config_//reg-a.example.com/:tokenHelper'] =
          '/usr/local/bin/get-token';
        process.env['pnpm_config_//reg-a.example.com/:username'] = '';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({});
      });

      it('lets the env tier beat the same auth.ini key', () => {
        writeAuthIni('//reg-a.example.com/:_authToken=ini-token');
        process.env['pnpm_config_//reg-a.example.com/:_authToken'] =
          'pnpm-env-token';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
          'npm_config_//reg-a.example.com/:_authToken': 'pnpm-env-token',
        });
      });

      it('counts an ambient credential the spawn keeps from 11.6.0 on', () => {
        // The spawn keeps the ambient URL-scoped token (mergeNpmConfigEnv), so npm
        // authenticates with it and there is no withheld credential to warn about.
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        process.env['npm_config_//reg-b.example.com/:_authToken'] = 'env-token';
        writeFileSync(
          join(root, '.npmrc'),
          'registry=https://reg-b.example.com/'
        );
        writeAuthIni('_authToken=ini-token');
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh('is-even', root, '11.6.0');
        });
        expect(logger.warn).not.toHaveBeenCalled();
      });

      it('leaves an ambient npm_config_ credential ahead of the same auth.ini key', () => {
        // Bridging the auth.ini value would put the key on the overlay, and
        // the merge then drops the ambient spelling npm would have read.
        writeAuthIni('//reg-a.example.com/:_authToken=ini-token');
        process.env['npm_config_//reg-a.example.com/:_authToken'] =
          'ambient-token';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({});
      });

      it('still bridges auth.ini over an ambient credential before 11.6.0', () => {
        writeAuthIni('//reg-a.example.com/:_authToken=ini-token');
        process.env['npm_config_//reg-a.example.com/:_authToken'] =
          'ambient-token';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
        });
      });

      it('prefers the pnpm_config_ spelling over the ambient and auth.ini ones', () => {
        writeAuthIni('//reg-a.example.com/:_authToken=ini-token');
        process.env['npm_config_//reg-a.example.com/:_authToken'] =
          'ambient-token';
        process.env['pnpm_config_//reg-a.example.com/:_authToken'] =
          'pnpm-env-token';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
          'npm_config_//reg-a.example.com/:_authToken': 'pnpm-env-token',
        });
      });

      it('does not re-key a bare auth.ini credential over an ambient one', () => {
        writeAuthIni(
          ['registry=https://reg-a.example.com/', '_authToken=ini-token'].join(
            '\n'
          )
        );
        process.env['npm_config_//reg-a.example.com/:_authToken'] =
          'ambient-token';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
      });

      it('lets auth.ini through when the ambient spelling is empty', () => {
        // npm skips an empty env value, so it suppresses nothing.
        writeAuthIni('//reg-a.example.com/:_authToken=ini-token');
        process.env['npm_config_//reg-a.example.com/:_authToken'] = '';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.6.0')).toEqual({
          'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
        });
      });
    });

    describe('pnpm_config__auth JSON tier (>= 11.10.0)', () => {
      it('bridges the registry and credential from pnpm_config__auth', () => {
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'json-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'json-token',
        });
      });

      it('does not read the tier before 11.10.0', () => {
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'json-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.9.0')).toEqual({});
      });

      it('nerf-darts a pathed registry URL the way pnpm does', () => {
        // Without a trailing slash the last path segment scopes the token to
        // its parent directory, per the shared npm/pnpm nerf-dart convention
        // (verified against pnpm 11.10.0).
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com/npm': { '@': { authToken: 'dir-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/npm',
          'npm_config_//reg-a.example.com/:_authToken': 'dir-token',
        });
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com/npm/': { '@': { authToken: 'dir-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/npm/',
          'npm_config_//reg-a.example.com/npm/:_authToken': 'dir-token',
        });
      });

      it('falls back to the uppercase spelling past an empty lowercase one', () => {
        process.env.pnpm_config__auth = '';
        process.env.PNPM_CONFIG__AUTH = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'upper-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'upper-token',
        });
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'lower-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'lower-token',
        });
      });

      it('lets the JSON registry beat the yaml default and lose to the env registry', () => {
        writeYaml('registries:\n  default: https://reg-b.example.com/\n');
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'json-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'json-token',
        });
        process.env.pnpm_config_registry = 'https://reg-d.example.com/';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-d.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'json-token',
        });
      });

      it('lets the JSON credential beat the URL-scoped env tier and auth.ini', () => {
        process.env['pnpm_config_//reg-a.example.com/:_authToken'] =
          'env-scoped';
        writeAuthIni(
          [
            'registry=https://reg-a.example.com/',
            '//reg-a.example.com/:_authToken=file-token',
          ].join('\n')
        );
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'json-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'json-token',
        });
      });

      it('bridges a scoped credential onto the plain dart for the fetched scope only', () => {
        // npm has no scope-qualified auth key, so the matching scope's token
        // lands on the plain dart, over the registry-wide one; entries for
        // other scopes stay out, since pnpm would not send them for this
        // package.
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': {
            '@': { authToken: 'wide-token' },
            '@myscope': { authToken: 'scoped-token' },
          },
          'https://reg-b.example.com': {
            '@other': { authToken: 'other-token' },
          },
        });
        expect(
          getPnpmSpawnRegistryEnv('@myscope/is-even', root, '11.10.0')
        ).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_@myscope:registry': 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'scoped-token',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'wide-token',
        });
      });

      it('reads _auth from the global config.yaml', () => {
        writeGlobalConfigYaml(
          [
            '_auth:',
            '  "https://reg-a.example.com":',
            '    "@":',
            '      authToken: yaml-token',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'yaml-token',
        });
      });

      it('merges the env tier over the global config.yaml per entry', () => {
        writeGlobalConfigYaml(
          [
            '_auth:',
            '  "https://reg-a.example.com":',
            '    "@":',
            '      authToken: yaml-token',
          ].join('\n')
        );
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com': { '@': { authToken: 'env-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'env-token',
        });
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-b.example.com': { '@': { authToken: 'env-token' } },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-b.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'yaml-token',
          'npm_config_//reg-b.example.com/:_authToken': 'env-token',
        });
      });

      it('fails on a pnpm_config__auth that is not valid JSON', () => {
        process.env.pnpm_config__auth = '{not json';
        expect(() =>
          getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')
        ).toThrow('is not valid JSON');
      });

      it.each([
        [
          'a non-object document',
          JSON.stringify(['https://reg-a.example.com']),
          'must be a JSON object of registry URLs',
        ],
        [
          'a non-http registry key',
          JSON.stringify({
            'ftp://reg-a.example.com': { '@': { authToken: 't' } },
          }),
          'is not a plain http(s) registry URL',
        ],
        [
          'a registry key with credentials',
          JSON.stringify({
            'https://user:pass@reg-a.example.com': { '@': { authToken: 't' } },
          }),
          'is not a plain http(s) registry URL',
        ],
        [
          'a bad scope',
          JSON.stringify({
            'https://reg-a.example.com': { org: { authToken: 't' } },
          }),
          'must map scopes',
        ],
        [
          'a missing auth field',
          JSON.stringify({
            'https://reg-a.example.com': { '@': { username: 'u' } },
          }),
          'must map scopes',
        ],
        [
          // Rejected only by the extra-field check: the token itself is valid,
          // so dropping that clause leaves this the one case that stops failing.
          'an auth field alongside the token',
          JSON.stringify({
            'https://reg-a.example.com': {
              '@': { authToken: 't', username: 'u' },
            },
          }),
          'must map scopes',
        ],
        [
          'a non-string token',
          JSON.stringify({
            'https://reg-a.example.com': { '@': { authToken: 42 } },
          }),
          'must map scopes',
        ],
      ])(
        'fails on %s, the way pnpm dies on it',
        (_label, value, expected: string) => {
          process.env.pnpm_config__auth = value;
          expect(() =>
            getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')
          ).toThrow(expected);
        }
      );

      it.each([
        ['a corrupt', '_auth: [unclosed\n'],
        ['a non-object', 'just-a-string\n'],
      ])(
        'fails on %s global config.yaml, the way pnpm dies on it',
        (_label, contents) => {
          writeGlobalConfigYaml(contents);
          expect(() =>
            getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')
          ).toThrow('global configuration file');
        }
      );

      it('treats an empty global config.yaml as declaring nothing', () => {
        writeGlobalConfigYaml('');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({});
      });
    });

    it('fails on a global config.yaml it cannot parse even before the JSON auth tier (pnpm dies on it)', () => {
      writeGlobalConfigYaml('npmrcAuthFile: [unclosed\n');
      expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
        'global configuration file'
      );
    });

    it('fails on a global config.yaml it cannot parse even when the env names the auth file (pnpm still dies on it)', () => {
      writePnpmOnlyUserConfig('');
      writeGlobalConfigYaml('npmrcAuthFile: [unclosed\n');
      expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
        'global configuration file'
      );
    });

    // pnpm reads the global config.yaml with no existence check in front, so
    // every fault but an absent file aborts it (measured on 11.5.0 and 11.20.0).
    // A symlink loop and a non-directory in the path fail the read with errnos
    // root cannot bypass, unlike a permission bit.
    describe('a global config.yaml that cannot be opened', () => {
      it('fails on a symlink loop rather than bridging the workspace registry pnpm never resolved', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        mkdirSync(join(configHome, 'pnpm'), { recursive: true });
        const path = join(configHome, 'pnpm', 'config.yaml');
        symlinkSync(path, path);

        expect(() =>
          getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')
        ).toThrow('global configuration file');
      });

      it('fails when the config dir is a file, so the path runs through a non-directory', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeFileSync(join(configHome, 'pnpm'), '');

        expect(() =>
          getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')
        ).toThrow('global configuration file');
      });
    });

    describe('a pnpm-workspace.yaml that cannot be opened', () => {
      // Neither lookup sees a symlink loop, so it stays absent on both sides of
      // the 11.8.0 boundary.
      it.each(['11.7.0', '11.8.0'])(
        'resolves on from the lower layers through a symlink loop on %s',
        (version) => {
          const { logger } = require('../logger');
          (logger.warn as jest.Mock).mockClear();
          // auth.ini rather than the user config: npm reads the latter itself,
          // so only a pnpm-only layer proves the bridge survived.
          writeAuthIni('registry=https://reg-b.example.com/\n');
          const path = join(root, 'pnpm-workspace.yaml');
          symlinkSync(path, path);

          expect(getPnpmSpawnRegistryEnv('is-even', root, version)).toEqual({
            npm_config_registry: 'https://reg-b.example.com/',
          });
          // Absent to pnpm as well, so there is nothing to tell the user about.
          expect(logger.warn).not.toHaveBeenCalled();
        }
      );

      // 11.8.0 swapped find-up, which requires the match to be a file, for a
      // bare existence check, so the same directory goes from looked past to
      // found and fatal.
      it('resolves on from a directory in its place before 11.8.0', () => {
        writeAuthIni('registry=https://reg-b.example.com/\n');
        mkdirSync(join(root, 'pnpm-workspace.yaml'));

        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.7.0')).toEqual({
          npm_config_registry: 'https://reg-b.example.com/',
        });
      });

      it('fails on a directory in its place from 11.8.0 on', () => {
        writeAuthIni('registry=https://reg-b.example.com/\n');
        mkdirSync(join(root, 'pnpm-workspace.yaml'));

        expect(() =>
          getPnpmSpawnRegistryEnv('is-even', root, '11.8.0')
        ).toThrow(/pnpm workspace file at .* could not be read/);
      });
    });

    describe('a registry whose path carries no trailing slash', () => {
      // pnpm's normalize-registry-url appends one from 11.15.1, which moves the
      // dart it pins a file's own credentials to a path segment deeper.
      it('pins an unscoped credential to the full path from 11.15.1', () => {
        writeAuthIni(
          [
            'registry=https://reg-a.example.com/api/npm/npm-virtual',
            '_authToken=ini-token',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.15.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/api/npm/npm-virtual',
          'npm_config_//reg-a.example.com/api/npm/:_authToken': 'ini-token',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.15.1')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/api/npm/npm-virtual',
          'npm_config_//reg-a.example.com/api/npm/npm-virtual/:_authToken':
            'ini-token',
        });
      });

      it('pins a JSON auth entry the same way', () => {
        process.env.pnpm_config__auth = JSON.stringify({
          'https://reg-a.example.com/api/npm/npm-virtual': {
            '@': { authToken: 'json-token' },
          },
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.15.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/api/npm/npm-virtual',
          'npm_config_//reg-a.example.com/api/npm/:_authToken': 'json-token',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.15.1')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/api/npm/npm-virtual',
          'npm_config_//reg-a.example.com/api/npm/npm-virtual/:_authToken':
            'json-token',
        });
      });

      it('finds client TLS material pinned below the plain dart', () => {
        // Both readers append the slash before darting, so the walk starts at the
        // request's own directory rather than at its parent.
        writeYaml(
          'registries:\n  default: https://reg-a.example.com/api/npm/npm-virtual\n'
        );
        writeAuthIni(
          [
            '//reg-a.example.com/api/npm/npm-virtual/:cert=-----BEGIN CERT-----',
            '//reg-a.example.com/api/npm/npm-virtual/:key=-----BEGIN KEY-----',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/api/npm/npm-virtual',
          npm_config_cert: '-----BEGIN CERT-----',
          npm_config_key: '-----BEGIN KEY-----',
        });
      });

      it('reports a credential npm holds there that pnpm would not send', () => {
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        // 11.5.3 withholds an entry whose value holds a reference; npm expands
        // the same line and authenticates with it.
        process.env.NX_TEST_TOKEN = 'project-token';
        writeYaml(
          'registries:\n  default: https://reg-a.example.com/api/npm/npm-virtual\n'
        );
        writeFileSync(
          join(root, '.npmrc'),
          '//reg-a.example.com/api/npm/npm-virtual/:_authToken=${NX_TEST_TOKEN}\n'
        );
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh('is-even', root, '11.5.3');
        });
        expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
          '//reg-a.example.com/api/npm/npm-virtual/'
        );
      });

      it('reports a token helper pinned there', () => {
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        writeYaml(
          'registries:\n  default: https://reg-a.example.com/api/npm/npm-virtual\n'
        );
        writeUserConfig(
          '//reg-a.example.com/api/npm/npm-virtual/:tokenHelper=/usr/local/bin/get-token'
        );
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh('is-even', root, '11.5.0');
        });
        expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain(
          'runs a token helper'
        );
      });
    });

    describe('the file pnpm authenticates from', () => {
      it('bridges a pnpm-only user config npm never opens', () => {
        writePnpmOnlyUserConfig(
          [
            'registry=https://reg-a.example.com/',
            '//reg-a.example.com/:_authToken=user-token',
            'https-proxy=http://proxy.example.com:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'user-token',
          npm_config_proxy: 'http://proxy.example.com:8080',
          npm_config_https_proxy: 'http://proxy.example.com:8080',
        });
      });

      it("leaves the same settings to npm when it is npm's own user config", () => {
        writeUserConfig(
          [
            'registry=https://reg-a.example.com/',
            '//reg-a.example.com/:_authToken=user-token',
            'https-proxy=http://proxy.example.com:8080',
          ].join('\n')
        );
        // Only the http proxy goes in: npm reads the file for the rest, but it
        // has no `proxy` of its own to fall back from `https-proxy` to, which
        // pnpm resolves for itself.
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_proxy: 'http://proxy.example.com:8080',
        });
      });

      it('resolves the proxy pair across it before deriving one from another', () => {
        // pnpm resolves all three settings everywhere first, so an https-proxy
        // here is what a legacy `proxy` above it leaves undeclared. Skipping the
        // file would derive an https-proxy from that `proxy` and overwrite npm's.
        writeUserConfig('https-proxy=http://user-proxy.example.com:8080');
        writeFileSync(
          join(root, '.npmrc'),
          'proxy=http://project-proxy.example.com:8080'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_proxy: 'http://user-proxy.example.com:8080',
        });
      });

      it('trusts the workspace .npmrc when it is that file, above auth.ini', () => {
        // pnpm's workspaceIsTrustedAuthFile: it expands the references it would
        // withhold from a project-controlled file, and the workspace copy of the
        // coincident path outranks auth.ini rather than sitting under it.
        process.env.NX_TEST_HOST = 'workspace.example.com';
        writeFileSync(
          join(root, '.npmrc'),
          [
            'registry=https://${NX_TEST_HOST}/',
            '//workspace.example.com/:_authToken=workspace-token',
          ].join('\n')
        );
        process.env.PNPM_CONFIG_NPMRC_AUTH_FILE = join(root, '.npmrc');
        writeAuthIni('registry=https://auth-ini.example.com/');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.15.1')).toEqual({});
      });

      it('ranks it under auth.ini and the workspace .npmrc', () => {
        writePnpmOnlyUserConfig(
          [
            'registry=https://reg-user.example.com/',
            '//reg-a.example.com/:_authToken=user-token',
          ].join('\n')
        );
        writeAuthIni(
          [
            'registry=https://reg-ini.example.com/',
            '//reg-a.example.com/:_authToken=ini-token',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-ini.example.com/',
          'npm_config_//reg-a.example.com/:_authToken': 'ini-token',
        });
      });
    });

    describe('reporting a credential pnpm would not send', () => {
      function warnFor(version: string, pkg = 'is-even'): jest.Mock {
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh(pkg, root, version);
        });
        return logger.warn as jest.Mock;
      }

      it('reports the one withheld from an entry holding an env reference', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeFileSync(
          join(root, '.npmrc'),
          '//reg-a.example.com/:_authToken=${NX_TEST_TOKEN}\n'
        );
        process.env.NX_TEST_TOKEN = 'a-token';
        // 11.5.2 expands it, so pnpm sends the same credential npm does.
        expect(warnFor('11.5.2')).not.toHaveBeenCalled();
        expect(warnFor('11.5.3').mock.calls[0][0]).toMatch(
          /npm will send the credential your .npmrc holds for \/\/reg-a.example.com\/ .*pnpm would not send it/s
        );
      });

      it('reports the one in the .npmrc a nested workspace hides from pnpm', () => {
        // pnpm reads the .npmrc beside the outer workspace file; npm opens the
        // inner one, which carries a credential pnpm never saw.
        const nested = join(root, 'nested');
        mkdirSync(nested, { recursive: true });
        writeYaml(
          'packages:\n  - "nested"\nregistries:\n  default: https://reg-a.example.com/\n'
        );
        writeFileSync(
          join(nested, '.npmrc'),
          '//reg-a.example.com/:_authToken=inner-token\n'
        );
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh('is-even', nested, '11.5.0');
        });
        expect((logger.warn as jest.Mock).mock.calls[0][0]).toMatch(
          /pnpm would not send it/
        );
      });

      it('stays quiet when pnpm reads that credential too', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeFileSync(
          join(root, '.npmrc'),
          '//reg-a.example.com/:_authToken=a-token\n'
        );
        expect(warnFor('11.5.3')).not.toHaveBeenCalled();
        expect(warnFor('10.16.0')).not.toHaveBeenCalled();
      });

      it('stays quiet for an ambient credential the 10.x line reads for itself', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        process.env['npm_config_//reg-a.example.com/:_authToken'] = 'env-token';
        expect(warnFor('10.16.0')).not.toHaveBeenCalled();
      });

      it('stays quiet where npm resolved the registry for itself', () => {
        // Nothing was bridged, so npm is using its own resolution and the
        // credentials that come with it, as it does outside migrate.
        writeFileSync(
          join(root, '.npmrc'),
          'registry=https://reg-a.example.com/\n//reg-a.example.com/:_authToken=a-token\n'
        );
        expect(warnFor('11.5.3')).not.toHaveBeenCalled();
      });
    });

    describe('token helpers', () => {
      // pnpm runs the command and sends what it prints (verified on 11.9.0). npm has
      // no equivalent setting.
      it('keeps a tokenHelper out of the overlay, and its siblings in', () => {
        writeAuthIni(
          [
            'registry=https://reg-a.example.com/',
            '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token',
            '//reg-b.example.com/:_authToken=b-token',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          'npm_config_//reg-b.example.com/:_authToken': 'b-token',
        });
      });

      // pnpm runs a helper only from its user auth file; the same line in auth.ini or
      // a project .npmrc aborts the command with TOKEN_HELPER_IN_PROJECT_CONFIG
      // (verified on 11.9.0).
      function warnFor(pkg = 'is-even'): jest.Mock {
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh(pkg, root, '11.5.0');
        });
        return logger.warn as jest.Mock;
      }

      it('reports a helper in the user auth file, naming the registry and not the command', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        const warn = warnFor();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('//reg-a.example.com/');
        expect(warn.mock.calls[0][0]).not.toContain('get-token');
      });

      it('warns once across packages', () => {
        const { logger } = require('../logger');
        (logger.warn as jest.Mock).mockClear();
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        jest.isolateModules(() => {
          const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
          fresh('is-even', root, '11.5.0');
          fresh('is-odd', root, '11.5.0');
        });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      it('reports an unscoped helper against the registry that file pins it to', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          [
            'registry=https://reg-a.example.com/',
            'tokenHelper=/usr/local/bin/get-token',
          ].join('\n')
        );
        expect(warnFor().mock.calls[0][0]).toContain('//reg-a.example.com/');
      });

      it('stays quiet when an unscoped helper is pinned elsewhere', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          [
            'registry=https://reg-other.example.com/',
            'tokenHelper=/usr/local/bin/get-token',
          ].join('\n')
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('leaves an unscoped helper on npmjs when its file names no registry', () => {
        // rescopeUnscopedCreds pins it to the declaring file's own registry, so
        // the yaml default that redirects npm does not carry it here. 10.x pins
        // the same line to the registry that wins overall instead.
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig('tokenHelper=/usr/local/bin/get-token');
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('keeps the overall-registry pin until rescoping arrives in 11.4.0', () => {
        const { logger } = require('../logger');
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig('tokenHelper=/usr/local/bin/get-token');
        for (const [version, warned] of [
          ['11.3.0', true],
          ['11.4.0', false],
        ] as const) {
          (logger.warn as jest.Mock).mockClear();
          jest.isolateModules(() => {
            const { getPnpmSpawnRegistryEnv: fresh } = require('./pnpm');
            fresh('is-even', root, version);
          });
          expect((logger.warn as jest.Mock).mock.calls.length > 0).toBe(warned);
        }
      });

      it('stays quiet about a helper for a registry npm will not contact', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          '//reg-other.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('stays quiet when a helper reference expands to nothing', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig('//reg-a.example.com/:tokenHelper=${PNPM_TEST_HELPER}');
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('stays quiet when a plain credential sits beside the helper in a file npm reads', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          [
            '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token',
            '//reg-a.example.com/:_authToken=user-token',
          ].join('\n')
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('reports the helper when that same file is one only pnpm reads', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writePnpmOnlyUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        expect(warnFor().mock.calls[0][0]).toContain('//reg-a.example.com/');
      });

      it('stays quiet about a helper whose file also carries a plain credential npm can be handed', () => {
        // A file only pnpm reads is bridged, so the plain credential beside the
        // helper reaches npm the same way one in npm's own user config does.
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writePnpmOnlyUserConfig(
          [
            '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token',
            '//reg-a.example.com/:_authToken=user-token',
          ].join('\n')
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('follows npmrcAuthFile from the global config.yaml', () => {
        const path = join(configHome, 'from-yaml.npmrc');
        writeFileSync(
          path,
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        mkdirSync(join(configHome, 'pnpm'), { recursive: true });
        writeFileSync(
          join(configHome, 'pnpm', 'config.yaml'),
          `npmrcAuthFile: ${path}\n`
        );
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        expect(warnFor().mock.calls[0][0]).toContain('//reg-a.example.com/');
      });

      it('stays quiet when the project .npmrc authenticates that registry anyway', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeFileSync(
          join(root, '.npmrc'),
          '//reg-a.example.com/:_authToken=project-token'
        );
        writeUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('stays quiet about a helper in auth.ini, which pnpm refuses to run', () => {
        writeAuthIni(
          [
            'registry=https://reg-a.example.com/',
            '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token',
          ].join('\n')
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('resolves a relative auth-file path against the config root', () => {
        // Both tools resolve a relative userconfig against the cwd they run in,
        // which is the config root the spawn uses, not this process's cwd.
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeFileSync(
          join(root, 'pnpm-auth.npmrc'),
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        process.env.PNPM_CONFIG_NPMRC_AUTH_FILE = 'pnpm-auth.npmrc';
        const warn = warnFor();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('//reg-a.example.com/');
      });

      it('does not count an ambient credential the spawn strips on 11.0-11.5', () => {
        // This pnpm line makes the spawn drop npm_config_* (mergeNpmConfigEnv), so npm
        // never receives the ambient token and fetches unauthenticated.
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        process.env['npm_config_//reg-a.example.com/:_authToken'] = 'env-token';
        const warn = warnFor();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('//reg-a.example.com/');
      });

      it('detects a helper whose key holds an env reference', () => {
        // pnpm expands ${VAR} in a key before reading the value under it.
        process.env.NX_TEST_HOST = 'reg-a.example.com';
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writePnpmOnlyUserConfig(
          '//${NX_TEST_HOST}/:tokenHelper=/usr/local/bin/get-token'
        );
        const warn = warnFor();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('//reg-a.example.com/');
      });

      it('counts a project .npmrc credential whose key holds an env reference', () => {
        // npm expands ${VAR} in an .npmrc key too, so it finds this token.
        process.env.NX_TEST_HOST = 'reg-a.example.com';
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        writeUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        writeFileSync(
          join(root, '.npmrc'),
          '//${NX_TEST_HOST}/:_authToken=project-token'
        );
        expect(warnFor()).not.toHaveBeenCalled();
      });

      it('lets a later env-keyed registry override an earlier literal one', () => {
        // Both readers expand each key and assign in file order, so the later one wins.
        process.env.NX_TEST_SCOPE = 'nx-test';
        writeFileSync(
          join(root, '.npmrc'),
          [
            '@nx-test:registry=https://reg-a.example.com/',
            '@${NX_TEST_SCOPE}:registry=https://reg-b.example.com/',
          ].join('\n')
        );
        writePnpmOnlyUserConfig(
          '//reg-b.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        const warn = warnFor('@nx-test/pkg');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('//reg-b.example.com/');
      });

      it('lets a later literal registry override an earlier env-keyed one', () => {
        process.env.NX_TEST_SCOPE = 'nx-test';
        writeFileSync(
          join(root, '.npmrc'),
          [
            '@${NX_TEST_SCOPE}:registry=https://reg-b.example.com/',
            '@nx-test:registry=https://reg-a.example.com/',
          ].join('\n')
        );
        writePnpmOnlyUserConfig(
          '//reg-a.example.com/:tokenHelper=/usr/local/bin/get-token'
        );
        const warn = warnFor('@nx-test/pkg');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('//reg-a.example.com/');
      });
    });

    describe('PNPM_CONFIG_* network settings', () => {
      // Every pairing below was measured on 11.9.0 in both directions.
      it('bridges a strict-ssl the env turns off, over the yaml', () => {
        writeYaml('strictSsl: true\n');
        process.env.PNPM_CONFIG_STRICT_SSL = 'false';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_strict_ssl: 'false',
        });
      });

      it('bridges a strict-ssl the env turns on, over the yaml', () => {
        writeYaml('strictSsl: false\n');
        process.env.PNPM_CONFIG_STRICT_SSL = 'true';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_strict_ssl: 'true',
        });
      });

      it('bridges the env proxies over the yaml ones', () => {
        writeYaml(
          [
            'proxy: http://yaml.example.com:8080',
            'httpsProxy: https://yaml.example.com:8443',
          ].join('\n')
        );
        process.env.PNPM_CONFIG_PROXY = 'http://env.example.com:8080';
        process.env.PNPM_CONFIG_HTTPS_PROXY = 'https://env.example.com:8443';
        // The legacy `proxy` only ever stands in for an httpsProxy that is
        // missing, and httpProxy falls back to whichever won, so a declared
        // httpsProxy leaves it serving neither scheme (measured on 11.20.0: an
        // unparseable `proxy` beside it never reaches the fetch).
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_proxy: 'https://env.example.com:8443',
          npm_config_https_proxy: 'https://env.example.com:8443',
        });
      });

      it('sends an http request through the env httpsProxy, as pnpm does', () => {
        // pnpm falls back from httpProxy to whichever proxy won, so one
        // declaration covers both schemes. Left on npm's `https-proxy` alone,
        // an http registry would be fetched direct.
        writeYaml('registries:\n  default: http://reg-a.example.com/\n');
        process.env.PNPM_CONFIG_HTTPS_PROXY = 'http://env.example.com:8080';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'http://reg-a.example.com/',
          npm_config_proxy: 'http://env.example.com:8080',
          npm_config_https_proxy: 'http://env.example.com:8080',
        });
      });

      it('bridges the env httpProxy only for the scheme it serves', () => {
        process.env.PNPM_CONFIG_HTTP_PROXY = 'http://env.example.com:8080';
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
        writeYaml('registries:\n  default: http://reg-a.example.com/\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'http://reg-a.example.com/',
          npm_config_proxy: 'http://env.example.com:8080',
        });
      });

      it('leaves a yaml httpsProxy standing under an env proxy, as pnpm does', () => {
        // pnpm resolves each proxy key across every tier before deriving one
        // from another, so an env `proxy` never displaces a yaml `httpsProxy`:
        // it only stands in for one that is missing. Measured on 11.20.0 with
        // a loopback proxy on each side.
        writeYaml(
          [
            'registries:',
            '  default: http://reg-a.example.com/',
            'httpsProxy: http://yaml.example.com:8080',
          ].join('\n')
        );
        process.env.PNPM_CONFIG_PROXY = 'http://env.example.com:8080';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'http://reg-a.example.com/',
          npm_config_proxy: 'http://yaml.example.com:8080',
          npm_config_https_proxy: 'http://yaml.example.com:8080',
        });
      });

      it('keeps a yaml httpProxy for the http request under an env httpsProxy', () => {
        writeYaml(
          [
            'registries:',
            '  default: http://reg-a.example.com/',
            'httpProxy: http://yaml.example.com:8080',
          ].join('\n')
        );
        process.env.PNPM_CONFIG_HTTPS_PROXY = 'http://env.example.com:8443';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'http://reg-a.example.com/',
          npm_config_proxy: 'http://yaml.example.com:8080',
          npm_config_https_proxy: 'http://env.example.com:8443',
        });
      });

      it('leaves an env cafile alone (pnpm never uses it to fetch)', () => {
        process.env.PNPM_CONFIG_CAFILE = '/etc/ssl/env-ca.pem';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
      });

      it('bridges PNPM_CONFIG_NO_PROXY over every other layer', () => {
        writeAuthIni('no-proxy=ini.example.com');
        writeYaml('noProxy: yaml.example.com\n');
        process.env.PNPM_CONFIG_NO_PROXY = 'env.example.com';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'env.example.com',
        });
      });

      it('keeps a no-proxy spelling ahead of PNPM_CONFIG_NOPROXY', () => {
        // pnpm reads `no-proxy` first and only then `noproxy`, so the spelling
        // decides before the layer does.
        writeFileSync(join(root, '.npmrc'), 'no-proxy=project.example.com');
        process.env.PNPM_CONFIG_NOPROXY = 'env.example.com';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'project.example.com',
        });
      });

      it('bridges a yaml noProxy on its own', () => {
        writeYaml('noProxy: yaml.example.com\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'yaml.example.com',
        });
      });

      it('keeps a yaml noProxy ahead of the files (yaml sits above them within the spelling)', () => {
        writeFileSync(join(root, '.npmrc'), 'no-proxy=project.example.com');
        writeAuthIni('no-proxy=ini.example.com');
        writeYaml('noProxy: yaml.example.com\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'yaml.example.com',
        });
      });

      it('bridges a yaml noproxy on its own (the tail of the chain)', () => {
        writeYaml('noproxy: yaml.example.com\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'yaml.example.com',
        });
      });

      it('bridges PNPM_CONFIG_NOPROXY over a yaml noproxy', () => {
        writeYaml('noproxy: yaml.example.com\n');
        process.env.PNPM_CONFIG_NOPROXY = 'env.example.com';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'env.example.com',
        });
      });

      it('keeps a workspace .npmrc no-proxy ahead of a yaml noproxy', () => {
        writeFileSync(join(root, '.npmrc'), 'no-proxy=project.example.com');
        writeYaml('noproxy: yaml.example.com\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_noproxy: 'project.example.com',
        });
      });

      it('reads the lowercase prefix below 11.0.6', () => {
        process.env.pnpm_config_https_proxy = 'https://env.example.com:8443';
        process.env.PNPM_CONFIG_PROXY = 'http://env.example.com:8080';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.5')).toEqual({
          // The uppercase spelling is unread here, and the httpsProxy the
          // lowercase one declares serves an http request too.
          npm_config_proxy: 'https://env.example.com:8443',
          npm_config_https_proxy: 'https://env.example.com:8443',
        });
      });

      it('treats an empty env value as declaring nothing', () => {
        writeYaml('proxy: http://yaml.example.com:8080\n');
        process.env.PNPM_CONFIG_PROXY = '';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_proxy: 'http://yaml.example.com:8080',
          // pnpm reads its legacy `proxy` as the https one too.
          npm_config_https_proxy: 'http://yaml.example.com:8080',
        });
      });

      it('leaves the env settings alone on 10.x (pnpm reads npm_config_* there)', () => {
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        process.env.PNPM_CONFIG_STRICT_SSL = 'false';
        process.env.PNPM_CONFIG_PROXY = 'http://env.example.com:8080';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.15.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
      });
    });

    describe('env references in a yaml settings file', () => {
      it('expands a registries value from 11.1.0', () => {
        process.env.NX_TEST_HOST = 'reg-env.example.com';
        writeYaml('registries:\n  default: https://${NX_TEST_HOST}/\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.1.0')).toEqual({
          npm_config_registry: 'https://reg-env.example.com/',
        });
      });

      it('leaves one literal below 11.1.0, escaped so npm reproduces it', () => {
        // pnpm's replacer skipped the registries map until then, so it contacts
        // the host spelled out. Handing npm the reference verbatim would have it
        // resolve one pnpm never did.
        process.env.NX_TEST_HOST = 'reg-env.example.com';
        writeYaml('registries:\n  default: https://${NX_TEST_HOST}/\n');
        for (const version of ['10.6.0', '10.18.0', '11.0.0']) {
          expect(getPnpmSpawnRegistryEnv('is-even', root, version)).toEqual({
            npm_config_registry: 'https://\\${NX_TEST_HOST}/',
          });
        }
      });

      it('leaves a scalar literal on 10.6.0, which has no replacer at all', () => {
        process.env.NX_TEST_HOST = 'proxy-env.example.com';
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'httpsProxy: http://${NX_TEST_HOST}:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.6.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          npm_config_proxy: 'http://\\${NX_TEST_HOST}:8080',
          npm_config_https_proxy: 'http://\\${NX_TEST_HOST}:8080',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.7.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          npm_config_proxy: 'http://proxy-env.example.com:8080',
          npm_config_https_proxy: 'http://proxy-env.example.com:8080',
        });
      });

      it('withholds a request destination holding one from 11.5.3', () => {
        process.env.NX_TEST_HOST = 'reg-env.example.com';
        writeYaml(
          [
            'registries:',
            '  default: https://${NX_TEST_HOST}/',
            'httpsProxy: http://${NX_TEST_HOST}:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.2')).toEqual({
          npm_config_registry: 'https://reg-env.example.com/',
          npm_config_proxy: 'http://reg-env.example.com:8080',
          npm_config_https_proxy: 'http://reg-env.example.com:8080',
        });
        // The proxies were not part of the withheld set yet, so only the
        // registry goes.
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.3')).toEqual({
          npm_config_proxy: 'http://reg-env.example.com:8080',
          npm_config_https_proxy: 'http://reg-env.example.com:8080',
        });
      });

      it('withholds a proxy holding one from 11.11.0', () => {
        process.env.NX_TEST_HOST = 'reg-env.example.com';
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'httpsProxy: http://${NX_TEST_HOST}:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          npm_config_proxy: 'http://reg-env.example.com:8080',
          npm_config_https_proxy: 'http://reg-env.example.com:8080',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.11.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
      });

      it('keeps expanding a setting that names no request destination', () => {
        // The withholding is scoped to the keys that decide where a request goes
        // and what authenticates it, so the rest resolve on past 11.5.3.
        process.env.NX_TEST_TOKEN = 'inline-ca-material';
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'ca: ${NX_TEST_TOKEN}',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.20.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          npm_config_ca: 'inline-ca-material',
        });
      });

      it('leaves an escaped reference for npm to consume, not resolved twice', () => {
        process.env.NX_TEST_TOKEN = 'resolved';
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'ca: keep-\\${NX_TEST_TOKEN}',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
          npm_config_ca: 'keep-\\${NX_TEST_TOKEN}',
        });
      });

      it('fails on a reference pnpm resolves nothing for, the way it aborts', () => {
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'nodeLinker: ${NX_TEST_UNSET_VAR}',
          ].join('\n')
        );
        // Not a request destination, so no version withholds it instead.
        for (const version of ['10.7.0', '11.5.2', '11.20.0']) {
          expect(() =>
            getPnpmSpawnRegistryEnv('is-even', root, version)
          ).toThrow(/references an environment variable that is not set/);
        }
        // 10.6.0 has no replacer, so the reference is never resolved and the
        // command it would have aborted runs.
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.6.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
      });

      it('fails on an unresolvable key, which no version withholds', () => {
        writeYaml('${NX_TEST_UNSET_VAR}Proxy: http://proxy.example.com:8080\n');
        expect(() =>
          getPnpmSpawnRegistryEnv('is-even', root, '11.20.0')
        ).toThrow(/references an environment variable that is not set/);
      });

      it('passes a nested setting through, which pnpm never expands', () => {
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'auditConfig:',
            '  ignoreCves:',
            '    - ${NX_TEST_UNSET_VAR}',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.20.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
      });
    });

    describe('TLS and proxy settings in a yaml settings file', () => {
      it('restores TLS verification for a strictSsl that is not the boolean', () => {
        // pnpm builds the agent that stops verifying for `strictSsl === false`
        // alone, so a string of the same spelling leaves verification on and
        // has to outrank a strict-ssl=false from a file below.
        writeFileSync(join(root, '.npmrc'), 'strict-ssl=false\n');
        writeYaml('strictSsl: "false"\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_strict_ssl: 'true',
        });
      });

      it('leaves an undeclared strictSsl to the files below', () => {
        writeFileSync(join(root, '.npmrc'), 'strict-ssl=false\n');
        writeYaml('registries:\n  default: https://reg-a.example.com/\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
      });

      it('bridges inline TLS material, which pnpm reads here unpinned', () => {
        writeYaml(['ca: ca-pem', 'cert: cert-pem', 'key: key-pem'].join('\n'));
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_ca: 'ca-pem',
          npm_config_cert: 'cert-pem',
          npm_config_key: 'key-pem',
        });
      });

      it('bridges an httpProxy only where npm asks for the scheme it serves', () => {
        // npm's `proxy` serves https as well when `https-proxy` is unset, so
        // bridging an http-only one would route a request pnpm sends direct.
        writeYaml(
          [
            'registries:',
            '  default: https://reg-a.example.com/',
            'httpProxy: http://proxy.example.com:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'https://reg-a.example.com/',
        });
        writeYaml(
          [
            'registries:',
            '  default: http://reg-a.example.com/',
            'httpProxy: http://proxy.example.com:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'http://reg-a.example.com/',
          npm_config_proxy: 'http://proxy.example.com:8080',
        });
      });

      it('prefers httpProxy over the httpsProxy it would fall back to', () => {
        writeYaml(
          [
            'registries:',
            '  default: http://reg-a.example.com/',
            'httpProxy: http://proxy-http.example.com:8080',
            'httpsProxy: http://proxy-https.example.com:8080',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_registry: 'http://reg-a.example.com/',
          npm_config_proxy: 'http://proxy-http.example.com:8080',
          npm_config_https_proxy: 'http://proxy-https.example.com:8080',
        });
      });
    });

    describe('a top-level registry in a yaml settings file', () => {
      it('is honored from 11.10.0, over the registries map beside it', () => {
        writeYaml(
          [
            'registry: https://reg-scalar.example.com/',
            'registries:',
            '  default: https://reg-map.example.com/',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.9.0')).toEqual({
          npm_config_registry: 'https://reg-map.example.com/',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-scalar.example.com/',
        });
      });

      it('loses to the named env registry and wins over the JSON auth tier', () => {
        writeYaml('registry: https://reg-scalar.example.com/\n');
        writeGlobalConfigYaml(
          '_auth:\n  https://reg-json.example.com/:\n    "@": { authToken: tok }\n'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-scalar.example.com/',
          'npm_config_//reg-json.example.com/:_authToken': 'tok',
        });
        process.env.PNPM_CONFIG_REGISTRY = 'https://reg-env.example.com/';
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-env.example.com/',
          'npm_config_//reg-json.example.com/:_authToken': 'tok',
        });
      });

      it('does not select a registry for a scope of its own', () => {
        // pnpm applies it onto registries.default alone, so a scoped package
        // still falls through to whatever declares that scope.
        writeYaml(
          [
            'registry: https://reg-scalar.example.com/',
            'registries:',
            '  "@types": https://reg-types.example.com/',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('@types/node', root, '11.10.0')).toEqual(
          {
            npm_config_registry: 'https://reg-scalar.example.com/',
            'npm_config_@types:registry': 'https://reg-types.example.com/',
          }
        );
      });
    });

    describe('settings in the global config.yaml', () => {
      it('bridges its registries from 11.11.0, under the workspace file', () => {
        writeGlobalConfigYaml(
          'registries:\n  default: https://reg-g.example.com/\n'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({});
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.11.0')).toEqual({
          npm_config_registry: 'https://reg-g.example.com/',
        });
        writeYaml('registries:\n  default: https://reg-w.example.com/\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.11.0')).toEqual({
          npm_config_registry: 'https://reg-w.example.com/',
        });
      });

      it('bridges its registry scalar from 11.5.3, under the workspace map until 11.10.0', () => {
        writeGlobalConfigYaml('registry: https://reg-g.example.com/\n');
        writeYaml('registries:\n  default: https://reg-w.example.com/\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.2')).toEqual({
          npm_config_registry: 'https://reg-w.example.com/',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.3')).toEqual({
          npm_config_registry: 'https://reg-w.example.com/',
        });
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.10.0')).toEqual({
          npm_config_registry: 'https://reg-g.example.com/',
        });
      });

      it('bridges its network settings from 11.0.0, under the workspace file', () => {
        writeGlobalConfigYaml(
          [
            'strictSsl: false',
            'httpsProxy: http://proxy-g.example.com:8080',
            'noProxy: g.example.com',
          ].join('\n')
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '10.18.0')).toEqual({});
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.0')).toEqual({
          npm_config_strict_ssl: 'false',
          npm_config_proxy: 'http://proxy-g.example.com:8080',
          npm_config_https_proxy: 'http://proxy-g.example.com:8080',
          npm_config_noproxy: 'g.example.com',
        });
        writeYaml('httpsProxy: http://proxy-w.example.com:8080\n');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.0')).toEqual({
          npm_config_strict_ssl: 'false',
          npm_config_proxy: 'http://proxy-w.example.com:8080',
          npm_config_https_proxy: 'http://proxy-w.example.com:8080',
          npm_config_noproxy: 'g.example.com',
        });
      });

      it('expands a request destination there, which pnpm trusts this file for', () => {
        process.env.NX_TEST_HOST = 'reg-env.example.com';
        writeGlobalConfigYaml(
          'registries:\n  default: https://${NX_TEST_HOST}/\n'
        );
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.20.0')).toEqual({
          npm_config_registry: 'https://reg-env.example.com/',
        });
      });
    });

    it('only honors the uppercase PNPM_CONFIG_REGISTRY env from 11.0.6', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      process.env.PNPM_CONFIG_REGISTRY = 'https://reg-up.example.com/';
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.5')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.6')).toEqual({
        npm_config_registry: 'https://reg-up.example.com/',
      });
    });
  });
});
