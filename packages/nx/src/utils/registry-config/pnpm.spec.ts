jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), verbose: jest.fn() },
}));

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getPnpmSpawnRegistryEnv } from './pnpm';

/**
 * Each case mirrors a cell verified against the real pnpm binaries (see the
 * gh-35843 investigation): registries map honored from 10.6.0, wholesale-wins
 * through 10.x, per-key specific-wins plus pnpm_config_registry env and
 * auth.ini from 11.0.0.
 */
describe('getPnpmSpawnRegistryEnv', () => {
  let root: string;
  let configHome: string;
  const managedEnvKeys = [
    'npm_config_registry',
    'NPM_CONFIG_REGISTRY',
    'Npm_Config_Registry',
    'pnpm_config_registry',
    'PNPM_CONFIG_REGISTRY',
    'npm_config_//reg-b.example.com/:_authToken',
    'PNPM_TEST_NOPROXY',
    'XDG_CONFIG_HOME',
  ];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-registry-pnpm-'));
    configHome = mkdtempSync(join(tmpdir(), 'nx-registry-pnpm-cfg-'));
    for (const key of managedEnvKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Point pnpm's config dir (auth.ini location) at a controlled directory.
    process.env.XDG_CONFIG_HOME = configHome;
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

  it('returns nothing when the version is unknown', () => {
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, null)).toEqual({});
  });

  it('fails on a pnpm-workspace.yaml that does not parse', () => {
    // pnpm aborts on it, so there is no resolution left to reproduce. Reading it
    // as an empty document instead would silently drop the registry it holds and
    // send the spawned npm to npmjs.
    writeYaml('registries:\n\tdefault: https://reg-a.example.com/\n');
    expect(() => getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toThrow(
      /pnpm workspace file at .* could not be read/
    );
  });

  it('returns nothing below 10.6.0 (registries map not honored by pnpm)', () => {
    writeYaml('registries:\n  default: https://reg-a.example.com/\n');
    expect(getPnpmSpawnRegistryEnv('is-even', root, '9.15.9')).toEqual({});
    expect(getPnpmSpawnRegistryEnv('is-even', root, '10.5.0')).toEqual({});
  });

  describe('10.6.0 - 10.x (yaml settings wholesale-replace the npmrc config)', () => {
    it('forces the yaml default registry', () => {
      // Setting the key is what makes the yaml pick win: it overrides whatever
      // npm_config_registry the spawned npm would otherwise inherit and honor
      // at its native env tier, which is pnpm's wholesale behavior here.
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

    it('bridges a workspace .npmrc no-proxy on 10.x too, which npm reads from no file', () => {
      writeFileSync(
        join(root, '.npmrc'),
        'https-proxy=http://proxy.example.com:8080\nno-proxy=internal.example.com'
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('leaves a workspace .npmrc noproxy alone on 10.x (npm reads it natively)', () => {
      writeFileSync(join(root, '.npmrc'), 'noproxy=internal.example.com');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({});
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
        npm_config_https_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it("bridges a yaml noproxy in npm's own spelling", () => {
      // pnpm answers to both spellings on this surface, unlike its siblings
      // (verified on 11.2.2 and 11.9.0 against a proxy: a `noproxy` bypass is
      // honored, while `httpsproxy` and `https-proxy` are ignored). Reading
      // only the camelCase key sent npm through a proxy pnpm bypasses.
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
        npm_config_https_proxy: 'http://proxy.example.com:8080',
        npm_config_noproxy: 'internal.example.com',
      });
    });

    it('prefers a yaml noProxy over noproxy when both are set', () => {
      // pnpm's own precedence (verified on 11.2.2 and 11.9.0: with noProxy
      // naming another host, a noproxy bypass for the registry stops applying).
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

    it('treats a registry that expanded to nothing as unset', () => {
      // npm skips an empty env value, and pnpm re-checks for an empty registry,
      // so neither reads one as a destination.
      delete process.env.NX_TEST_UNSET_REGISTRY;
      writeAuthIni('registry=${NX_TEST_UNSET_REGISTRY}');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('treats a cafile that expanded to nothing as unset', () => {
      // An empty cafile would otherwise resolve to the workspace root, handing
      // npm a directory where it expects a certificate file.
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
      // The re-key lands at npm's env tier, which outranks the file npm reads
      // for itself, so the user-level credential would displace the workspace
      // one that pnpm prefers.
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
      // npm reads that credential itself, so the request is authenticated and
      // there is nothing to report.
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
      // npm walks up the nerf dart, so a credential on the host covers a
      // registry served from a path below it.
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

    it('stays quiet when the credential comes from the environment', () => {
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
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('still warns when the credential npm would find is incomplete', () => {
      // npm needs username and _password together, so a lone username leaves
      // the request unauthenticated after all.
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
      // The npmrc-dir base landed in 11.2.0; before it the only reader is
      // loadCAFile, a bare readFileSync on the raw value, so the path is
      // relative to the cwd. npm ignores a cafile it cannot open, so using the
      // wrong base here drops the trust anchor with no diagnostic.
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

    it('drops auth.ini cert/key when an ambient npm registry redirects the request', () => {
      // pnpm >= 11 ignores npm_config_*, so nothing in the overlay displaces an
      // ambient one; the spawned npm reads it and contacts that host instead.
      process.env.NPM_CONFIG_REGISTRY = 'https://reg-b.example.com/';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('reads the ambient registry under any casing npm accepts', () => {
      process.env.Npm_Config_Registry = 'https://reg-b.example.com/';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('takes the last ambient spelling when several are set', () => {
      process.env.npm_config_registry = 'https://registry.npmjs.org/';
      process.env.NPM_CONFIG_REGISTRY = 'https://reg-b.example.com/';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
    });

    it('takes the last ambient spelling whichever casing it is', () => {
      process.env.NPM_CONFIG_REGISTRY = 'https://reg-b.example.com/';
      process.env.npm_config_registry = 'https://registry.npmjs.org/';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
      });
    });

    it('ignores an empty ambient registry (npm skips it too)', () => {
      process.env.NPM_CONFIG_REGISTRY = '';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
      });
    });

    it('reads a blank ambient registry as npm default (npm trims it away)', () => {
      process.env.NPM_CONFIG_REGISTRY = '   ';
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
      });
    });

    it('reads an ambient registry that expands to nothing as npm default', () => {
      // npm's pickRegistry falls through on a falsy registry, so the request
      // still goes to npmjs, which is what the credentials are pinned to.
      process.env.NPM_CONFIG_REGISTRY = '${NX_TEST_UNSET_REGISTRY?}';
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

    // pnpm accepts both `no-proxy` (which wins) and `noproxy`; npm knows only
    // `noproxy` and warns about `no-proxy` as an unknown config, so the bypass
    // list has to be re-spelled from whichever npmrc-family file pnpm takes it
    // from, plus from auth.ini under either spelling since npm cannot read it.
    it("bridges an auth.ini no-proxy under npm's noproxy spelling", () => {
      writeAuthIni(
        [
          'https-proxy=http://proxy.example.com:8080',
          'no-proxy=internal.example.com',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
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
      // npm resolves https-proxy from the .npmrc itself, so only the bypass list
      // needs an env entry.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
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

    it('bridges no no-proxy when the workspace .npmrc cannot be read', () => {
      writeAuthIni('no-proxy=ini.example.com');
      // A directory in its place: the file exists and reads as an error, so the
      // layer that outranks auth.ini is unknown rather than absent.
      mkdirSync(join(root, '.npmrc'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({});
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

    it('only honors the uppercase PNPM_CONFIG_REGISTRY env from 11.0.6', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      process.env.PNPM_CONFIG_REGISTRY = 'https://reg-up.example.com/';
      // 11.0.5 and below ignore the uppercase form, so the yaml default wins.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.5')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
      // 11.0.6+ honors it.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.6')).toEqual({
        npm_config_registry: 'https://reg-up.example.com/',
      });
    });
  });
});
