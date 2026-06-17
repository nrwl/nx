// pnpm seeds its HOME from os.homedir(), which the cafile ~/ expansion mirrors;
// os.homedir() ignores a runtime process.env.HOME under jest, so mock it.
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => jest.requireActual('os').homedir()),
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

    it('ignores npm_config_registry env (yaml wins wholesale in pnpm 10.x)', () => {
      // The injected yaml registry must defeat a user-set npm_config_registry
      // (which npm would otherwise honor at its native env tier), matching pnpm.
      process.env.npm_config_registry = 'https://reg-c.example.com/';
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '10.16.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
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

    it('coerces auth.ini strict-ssl the way npm/nopt does (numeric zero is false)', () => {
      writeAuthIni('strict-ssl=0');
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_strict_ssl: 'false',
      });
    });

    it('bridges flat ca/cert/key from auth.ini (npm has no inline scoped form)', () => {
      writeYaml('registries:\n  default: https://reg-a.example.com/\n');
      writeAuthIni(['cert=CERTPEM', 'key=KEYPEM', 'ca=CAPEM'].join('\n'));
      expect(getPnpmSpawnRegistryEnv('is-even', root, '11.5.0')).toEqual({
        npm_config_registry: 'https://reg-a.example.com/',
        npm_config_cert: 'CERTPEM',
        npm_config_key: 'KEYPEM',
        npm_config_ca: 'CAPEM',
      });
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
