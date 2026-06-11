import { join, resolve } from 'path';
import { gte } from 'semver';
import {
  getBunGlobalConfigBase,
  readBunfigRaw,
} from '../package-manager-config/bunfig';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import {
  expandEnvVars,
  getPackageScope,
  nerfDart,
  setAuthToken,
  setCafile,
  setRegistry,
  setScopedRegistry,
  type NpmConfigEnv,
} from './utils';

/*
 * bun registry resolution (verified on 1.2.23 and 1.3.14, gates bisected):
 *
 * CLI --registry > BUN_CONFIG_REGISTRY > NPM_CONFIG_REGISTRY >
 * npm_config_registry > project .npmrc > global ($XDG_CONFIG_HOME else
 * $HOME)/.npmrc > project bunfig.toml > global bunfig > registry.npmjs.org.
 * .npmrc beats bunfig at every level, including scoped keys. Env registry
 * values must start with http(s):// or they are ignored. .npmrc support
 * exists from bun 1.1.18; [install].ca/cafile from 1.1.31. When
 * XDG_CONFIG_HOME is set, bun reads $XDG_CONFIG_HOME/.npmrc INSTEAD of
 * ~/.npmrc (npm always reads ~/.npmrc, so the userconfig is swapped to
 * mirror that).
 *
 * The final default/scoped registry is always injected: bun does not read
 * npm-only surfaces (e.g. $PREFIX/etc/npmrc), so npm must not fall back to
 * them.
 */

const BUN_DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

interface BunRegistryValue {
  url: string;
  token?: string;
  username?: string;
  password?: string;
}

interface BunfigInstall {
  registry?: string | BunRegistryValue;
  scopes?: Record<string, string | BunRegistryValue>;
  ca?: string | string[];
  cafile?: string;
}

export function getBunSpawnRegistryEnv(
  packageName: string,
  root: string,
  bunVersion: string | null
): NpmConfigEnv {
  const env: NpmConfigEnv = {};
  const scope = getPackageScope(packageName);
  // Unknown version: assume a current bun (all gates passed).
  const npmrcSupported = !bunVersion || gte(bunVersion, '1.1.18');
  const tlsSupported = !bunVersion || gte(bunVersion, '1.1.31');

  const globalConfigBase = getBunGlobalConfigBase(process.env);
  const projectNpmrc = npmrcSupported
    ? readNpmrcMap(join(root, '.npmrc'))
    : null;
  const globalNpmrc =
    npmrcSupported && globalConfigBase
      ? readNpmrcMap(join(globalConfigBase, '.npmrc'))
      : null;
  const projectBunfig = readBunfigInstall(join(root, 'bunfig.toml'));
  const globalBunfig = globalConfigBase
    ? readBunfigInstall(join(globalConfigBase, '.bunfig.toml'))
    : null;

  // bun's global npmrc replaces the user npmrc when XDG_CONFIG_HOME is set;
  // swap npm's userconfig so the auth/TLS keys npm reads natively come from
  // the same file bun would use.
  if (npmrcSupported && process.env.XDG_CONFIG_HOME) {
    env['npm_config_userconfig'] = join(process.env.XDG_CONFIG_HOME, '.npmrc');
  }

  const envRegistry = [
    process.env.BUN_CONFIG_REGISTRY,
    process.env.NPM_CONFIG_REGISTRY,
    process.env.npm_config_registry,
  ].find((value) => value && /^https?:\/\//.test(value));

  const npmrcValue = (key: string): string | undefined => {
    const raw = projectNpmrc?.get(key) ?? globalNpmrc?.get(key);
    return raw === undefined ? undefined : expandEnvVars(raw);
  };
  const bunfigValue = (
    read: (install: BunfigInstall) => string | BunRegistryValue | undefined
  ): BunRegistryValue | undefined => {
    for (const install of [projectBunfig, globalBunfig]) {
      if (!install) {
        continue;
      }
      const value = read(install);
      if (value !== undefined) {
        return normalizeBunRegistryValue(value);
      }
    }
    return undefined;
  };

  const npmrcRegistry = npmrcValue('registry');
  const defaultPick: BunRegistryValue = envRegistry
    ? { url: envRegistry }
    : npmrcRegistry
      ? { url: npmrcRegistry }
      : (bunfigValue((install) => install.registry) ?? {
          url: BUN_DEFAULT_REGISTRY,
        });
  setRegistry(env, defaultPick.url);
  applyBunAuth(env, defaultPick);

  if (scope) {
    const npmrcScoped = npmrcValue(`${scope}:registry`);
    // [install.scopes] keys are accepted with or without the leading @.
    const scopedPick: BunRegistryValue = npmrcScoped
      ? { url: npmrcScoped }
      : (bunfigValue(
          (install) =>
            install.scopes?.[scope] ?? install.scopes?.[scope.slice(1)]
        ) ?? defaultPick);
    setScopedRegistry(env, scope, scopedPick.url);
    if (scopedPick !== defaultPick) {
      applyBunAuth(env, scopedPick);
    }
  }

  if (tlsSupported) {
    // .npmrc TLS keys beat bunfig's; npm reads the npmrc family natively.
    const npmrcHasTls =
      projectNpmrc?.has('cafile') ||
      projectNpmrc?.has('ca') ||
      globalNpmrc?.has('cafile') ||
      globalNpmrc?.has('ca');
    if (!npmrcHasTls) {
      const cafile = projectBunfig?.cafile ?? globalBunfig?.cafile;
      if (cafile) {
        // bun resolves cafile relative to the project dir.
        setCafile(env, resolve(root, cafile));
      } else {
        const ca = projectBunfig?.ca ?? globalBunfig?.ca;
        if (ca) {
          // npm encodes a config array through the env by joining on a blank
          // line (\n\n), and splits on it to reconstruct the array, so join an
          // array form that way for each inline CA to round-trip distinctly.
          env['npm_config_ca'] = Array.isArray(ca) ? ca.join('\n\n') : ca;
        }
      }
    }
  }

  return env;
}

/**
 * Bunfig registry values: a URL string (possibly with embedded
 * `user:pass@`/`:token@` credentials) or a `{ url, token, username, password }`
 * table.
 */
function normalizeBunRegistryValue(
  value: string | BunRegistryValue
): BunRegistryValue {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      // bun records user+pass, or a bare password as a token; a username with
      // no password carries no credentials (it is dropped, keeping the url).
      const credentials =
        url.username && url.password
          ? { username: url.username, password: url.password }
          : url.password
            ? // `https://:token@host/` carries a token as the bare password.
              { token: url.password }
            : {};
      url.username = '';
      url.password = '';
      return { url: url.toString(), ...credentials };
    }
  } catch {}
  return { url: value };
}

function applyBunAuth(env: NpmConfigEnv, value: BunRegistryValue): void {
  if (value.token) {
    setAuthToken(env, value.url, value.token);
  } else if (value.username && value.password) {
    const dart = nerfDart(value.url);
    if (dart) {
      env[`npm_config_${dart}:username`] = value.username;
      // npm expects _password base64-encoded.
      env[`npm_config_${dart}:_password`] = Buffer.from(
        value.password
      ).toString('base64');
    }
  }
}

function readBunfigInstall(path: string): BunfigInstall | null {
  const parsed = readBunfigRaw(path);
  // An unparseable bunfig aborts bun itself; skip the surface here.
  if (parsed === null || parsed === 'invalid') {
    return null;
  }
  const install = parsed.install;
  return install && typeof install === 'object'
    ? (install as BunfigInstall)
    : null;
}
