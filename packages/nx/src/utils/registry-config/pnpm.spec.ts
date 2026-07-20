// pnpm seeds its HOME from os.homedir(), which the cafile ~/ expansion mirrors;
// os.homedir() ignores a runtime process.env.HOME under jest, so mock it.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => jest.requireActual('os').homedir()),
}));
jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), verbose: jest.fn() },
}));

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
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
    'pnpm_config_registry',
    'PNPM_CONFIG_REGISTRY',
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

    it('forces both keys to the scoped entry for a scoped package', () => {
      writeYaml(
        'registries:\n  default: https://reg-a.example.com/\n  "@types": https://reg-e.example.com/\n'
      );
      expect(getPnpmSpawnRegistryEnv('@types/node', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-e.example.com/',
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
      // An empty npm_config_registry sends npm to the public registry instead
      // of failing, so the key must not be emitted at all.
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

    it('warns once when a bare auth.ini credential cannot reach the contacted registry', () => {
      // The pin leaves the request unauthenticated, so npm reports a bare 401
      // with nothing tying it back to auth.ini.
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
        'https://reg-b.example.com/'
      );
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

    it('bridges flat TLS/proxy keys from auth.ini (cafile resolved against the workspace cwd)', () => {
      writeAuthIni(
        [
          'cafile=./ca.pem',
          'strict-ssl=false',
          'https-proxy=http://proxy.example.com:8443',
        ].join('\n')
      );
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_cafile: join(root, 'ca.pem'),
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

    it('expands a ~/ auth.ini cafile against the home dir', () => {
      (homedir as jest.Mock).mockReturnValue('/home/testuser');
      try {
        writeAuthIni('cafile=~/certs/ca.pem');
        expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
          npm_config_cafile: join('/home/testuser', 'certs/ca.pem'),
        });
      } finally {
        (homedir as jest.Mock).mockReturnValue(
          jest.requireActual('os').homedir()
        );
      }
    });

    it('only honors the uppercase PNPM_CONFIG_REGISTRY env from 11.1.0', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      process.env.PNPM_CONFIG_REGISTRY = 'https://reg-up.example.com/';
      // 11.0.x ignores the uppercase form, so the yaml default wins.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.0.4')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
      });
      // 11.1.0+ honors it.
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.1.0')).toEqual({
        npm_config_registry: 'https://reg-up.example.com/',
      });
    });
  });
});
