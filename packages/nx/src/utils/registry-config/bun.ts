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
 *
 * See https://github.com/oven-sh/bun/blob/bun-v1.2.23/src/install/PackageManager.zig#L791
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

  // A registry read from an .npmrc goes through both of bun's expansions: its
  // ini reader resolves `${VAR}` anywhere in the value, and the scope it then
  // builds resolves a value that starts with `$` as a whole variable name. So
  // `registry=$MY_REGISTRY` is honored, which `${VAR}` alone would leave as a
  // literal for npm to reject as an invalid URL.
  const npmrcRegistryValue = (key: string): string | undefined => {
    const raw = projectNpmrc?.get(key) ?? globalNpmrc?.get(key);
    return raw === undefined
      ? undefined
      : expandBunRegistryUrl(expandEnvVars(raw));
  };
  const bunfigValue = (
    read: (install: BunfigInstall) => string | BunRegistryValue | undefined,
    fallbackUrl: string
  ): BunRegistryValue | undefined => {
    for (const install of [projectBunfig, globalBunfig]) {
      if (!install) {
        continue;
      }
      const value = read(install);
      if (value !== undefined) {
        return normalizeBunRegistryValue(value, fallbackUrl);
      }
    }
    return undefined;
  };

  const npmrcRegistry = npmrcRegistryValue('registry');
  const defaultPick: BunRegistryValue = envRegistry
    ? { url: envRegistry }
    : npmrcRegistry
      ? { url: npmrcRegistry }
      : (bunfigValue((install) => install.registry, BUN_DEFAULT_REGISTRY) ?? {
          url: BUN_DEFAULT_REGISTRY,
        });
  setRegistry(env, defaultPick.url);
  applyBunAuth(env, defaultPick);

  if (scope) {
    const npmrcScoped = npmrcRegistryValue(`${scope}:registry`);
    // [install.scopes] keys are accepted with or without the leading @.
    const scopedPick: BunRegistryValue = npmrcScoped
      ? { url: npmrcScoped }
      : (bunfigValue(
          (install) =>
            install.scopes?.[scope] ?? install.scopes?.[scope.slice(1)],
          // A scope entry that declares only credentials keeps the default
          // registry as its url, so its token still reaches the right host.
          defaultPick.url
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
  value: string | BunRegistryValue,
  fallbackUrl: string
): BunRegistryValue {
  if (typeof value !== 'string') {
    // Table form: bun expands a whole-value `$VAR` in the url (Scope.fromAPI)
    // and in each credential field (env.getAuto) before use. Bun accepts the
    // table without a url and leaves the enclosing registry in place.
    const result: BunRegistryValue = {
      url: value.url ? expandBunRegistryUrl(value.url) : fallbackUrl,
    };
    for (const field of ['token', 'username', 'password'] as const) {
      const expanded = expandBunAuthValue(value[field]);
      if (expanded !== undefined) {
        result[field] = expanded;
      }
    }
    return result;
  }
  const expanded = expandBunRegistryUrl(value);
  try {
    const url = new URL(expanded);
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
  return { url: expanded };
}

// Bun expands a whole-value `$VARNAME` reference (no braces) in bunfig
// credential fields via env.getAuto; an unset var keeps the literal. Braces
// (${VAR}) are not expanded by bun in bunfig (only in its .npmrc).
function expandBunAuthValue(value: string | undefined): string | undefined {
  if (value === undefined || value.length < 2 || value[0] !== '$') {
    return value;
  }
  return process.env[value.slice(1)] ?? value;
}

// Bun expands a `$`-prefixed bunfig registry URL (Scope.fromAPI): it looks up
// the name with surrounding slashes trimmed and uses it only when the result is
// longer than one character, else keeps the literal.
function expandBunRegistryUrl(value: string): string {
  if (!value || value[0] !== '$') {
    return value;
  }
  const name = value.slice(1).replace(/^\/+|\/+$/g, '');
  const replaced = process.env[name];
  return replaced && replaced.length > 1 ? replaced : value;
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
  if (parsed === null) {
    return null;
  }
  if (parsed === 'invalid') {
    // bun aborts on a bunfig it cannot read or parse, so there is no resolution
    // left to reproduce, the same as for the wrong-shaped values below. Both
    // propagate to the caller's fall-open. Skipping the file instead would pin
    // npm to the default registry as though the workspace configured none,
    // overriding a registry npm resolves from a file of its own.
    throw new Error(`The bunfig at ${path} could not be read.`);
  }
  const install = parsed.install;
  if (!install || typeof install !== 'object' || Array.isArray(install)) {
    return null;
  }
  validateBunfigInstall(install as BunfigInstall, path);
  return install as BunfigInstall;
}

/**
 * Bun type-checks the [install] table before it resolves anything and aborts on
 * a value of the wrong shape ("Expected registry to be a URL string or an
 * object", "Invalid cafile. Expected a string."). Reproduce that rather than
 * carrying a number into a URL parse or a path join, where it would either
 * throw somewhere unrelated or bridge a value bun never accepted.
 */
function validateBunfigInstall(install: BunfigInstall, path: string): void {
  const fail = (what: string): never => {
    throw new Error(`The bunfig at ${path} declares ${what}.`);
  };
  if (install.registry !== undefined) {
    validateBunRegistryValue(install.registry, 'install.registry', fail);
  }
  if (install.scopes !== undefined) {
    if (typeof install.scopes !== 'object' || Array.isArray(install.scopes)) {
      fail('an install.scopes that is not a table');
    }
    for (const [key, value] of Object.entries(install.scopes)) {
      validateBunRegistryValue(value, `install.scopes["${key}"]`, fail);
    }
  }
  if (install.cafile !== undefined && typeof install.cafile !== 'string') {
    fail('an install.cafile that is not a string');
  }
  if (
    install.ca !== undefined &&
    typeof install.ca !== 'string' &&
    !(
      Array.isArray(install.ca) &&
      install.ca.every((entry) => typeof entry === 'string')
    )
  ) {
    fail('an install.ca that is neither a string nor an array of strings');
  }
}

function validateBunRegistryValue(
  value: unknown,
  setting: string,
  fail: (what: string) => never
): void {
  if (typeof value === 'string') {
    return;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`a ${setting} that is neither a URL string nor a table`);
  }
  for (const field of ['url', 'token', 'username', 'password'] as const) {
    const field_ = (value as Record<string, unknown>)[field];
    if (field_ !== undefined && typeof field_ !== 'string') {
      fail(`a ${setting}.${field} that is not a string`);
    }
  }
}
