import { dirname } from 'path';
import { logger } from '../logger';

/**
 * Environment entries (npm_config_* keys) to overlay on a spawned npm process
 * so its per-key config resolution reproduces the workspace package manager's
 * own registry/auth/TLS resolution. npm parses these at its env tier: above
 * every .npmrc level, below CLI flags (we never pass registry CLI flags).
 */
export type NpmConfigEnv = Record<string, string>;

export function getPackageScope(packageName: string): string | null {
  if (packageName.startsWith('@')) {
    const slash = packageName.indexOf('/');
    if (slash > 0) {
      return packageName.slice(0, slash);
    }
  }
  return null;
}

/**
 * Converts a registry URL into npm's nerf-dart key prefix (host + directory
 * path), e.g. `https://r.example.com/npm/` -> `//r.example.com/npm/`. Returns
 * null for unparseable URLs.
 * See https://github.com/npm/cli/blob/bb056c85059cfb39514614e31abba09f20ac1612/workspaces/config/lib/nerf-dart.js#L12-L17
 */
export function nerfDart(registryUrl: string): string | null {
  try {
    const url = new URL(registryUrl);
    const dir = url.pathname.endsWith('/')
      ? url.pathname
      : url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    return `//${url.host}${dir}`;
  } catch {
    return null;
  }
}

/**
 * The setting name npm resolves an environment key to: a case-insensitive
 * `npm_config_` prefix and a positional slice, then `_` -> `-` and lowercase
 * for every key but a nerf-darted one. Null for a key npm does not read.
 * See https://github.com/npm/cli/blob/bb056c85059cfb39514614e31abba09f20ac1612/workspaces/config/lib/index.js#L345-L356
 */
function npmConfigSetting(envKey: string): string | null {
  if (!/^npm_config_/i.test(envKey)) {
    return null;
  }
  const key = envKey.slice('npm_config_'.length);
  return key.startsWith('//') ? key : normalizeNpmConfigKey(key);
}

/** npm's key rewrite: non-leading `_` to `-`, then lowercased. */
export function normalizeNpmConfigKey(key: string): string {
  return key.replace(/(?!^)_/g, '-').toLowerCase();
}

/**
 * The value npm resolves for `setting` out of an environment: every
 * `npm_config_*` spelling maps onto the same setting and the last one read
 * wins, and an empty value is skipped outright (loadEnv). `setting` is the name
 * npm looks the value up under, so a scope npm rewrites (`@my_scope`) finds
 * nothing, exactly as it does for npm itself.
 */
export function readNpmConfigEnv(
  env: NodeJS.ProcessEnv,
  setting: string
): string | undefined {
  let value: string | undefined;
  for (const [key, candidate] of Object.entries(env)) {
    if (candidate && npmConfigSetting(key) === setting) {
      value = candidate;
    }
  }
  return value;
}

/** The registry, auth and TLS settings this module resolves for a package manager. */
const BRIDGED_SETTINGS = new Set([
  'registry',
  'ca',
  'cafile',
  'cert',
  'key',
  'strict-ssl',
  'proxy',
  'https-proxy',
  'noproxy',
]);

/**
 * Whether `setting` is one this module resolves on the package manager's behalf,
 * covering the nerf-darted credential/TLS keys and any `@scope:registry` as
 * well as the flat names above. `userconfig` is deliberately absent: it selects
 * npm's own config file rather than a value the package manager resolves, and
 * npm reading its own .npmrc is outside what the overlay reproduces.
 */
function isBridgedSetting(setting: string): boolean {
  return (
    setting.startsWith('//') ||
    setting.endsWith(':registry') ||
    BRIDGED_SETTINGS.has(setting)
  );
}

/**
 * Merges an npm_config_* overlay into the environment for a spawned npm,
 * leaving one spelling per setting: the overlay's where it carries the setting,
 * otherwise the ambient one npm itself would resolve. npm reads its env tier
 * last-write-wins over the received key order, and both macOS `/bin/sh` and
 * npm's own shell launcher rebuild that order, so a setting left spelled two
 * ways (`NPM_CONFIG_REGISTRY` beside `npm_config_registry`) goes to whichever
 * one they happen to emit last instead of to the value resolved here.
 *
 * `managerIgnoresEnv` says the package manager resolves the settings above
 * without reading `npm_config_*` at all, so an ambient one is a value it would
 * never have seen. Those are dropped even where the overlay claims nothing:
 * npm's env tier sits above every file, so leaving one in place does not just
 * add a value, it stops npm from reaching the .npmrc chain that the package
 * manager itself resolved from.
 */
export function mergeNpmConfigEnv(
  baseEnv: NodeJS.ProcessEnv,
  overlay: NpmConfigEnv,
  managerIgnoresEnv = false
): NodeJS.ProcessEnv {
  const overlaid = new Set(
    Object.keys(overlay).map(npmConfigSetting).filter(Boolean)
  );
  const merged: NodeJS.ProcessEnv = {};
  const keptSpelling = new Map<string, string>();
  for (const [key, value] of Object.entries(baseEnv)) {
    const setting = npmConfigSetting(key);
    if (setting === null) {
      merged[key] = value;
      continue;
    }
    // Even an empty ambient entry goes when the overlay carries the setting: a
    // Windows environment is case-insensitive, and only the first spelling in
    // it reaches the child, which would be this one rather than the overlay's.
    if (overlaid.has(setting)) {
      continue;
    }
    if (managerIgnoresEnv && isBridgedSetting(setting)) {
      continue;
    }
    // npm skips an empty value, so it neither overrides nor competes.
    if (!value) {
      merged[key] = value;
      continue;
    }
    const superseded = keptSpelling.get(setting);
    if (superseded !== undefined) {
      delete merged[superseded];
    }
    keptSpelling.set(setting, key);
    merged[key] = value;
  }
  return { ...merged, ...overlay };
}

export function setRegistry(env: NpmConfigEnv, url: string): void {
  env['npm_config_registry'] = url;
}

export function setScopedRegistry(
  env: NpmConfigEnv,
  scope: string,
  url: string
): void {
  env[`npm_config_${scope}:registry`] = url;
}

export function setAuthToken(
  env: NpmConfigEnv,
  registryUrl: string,
  token: string
): void {
  const dart = nerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:_authToken`] = token;
  }
}

/** `_auth` carries base64(user:pass); callers must pass it pre-encoded. */
export function setAuthIdent(
  env: NpmConfigEnv,
  registryUrl: string,
  base64Ident: string
): void {
  const dart = nerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:_auth`] = base64Ident;
  }
}

/**
 * npm presents a client certificate only when both halves are configured, so
 * they are set together; each is a path, not the material itself.
 * See https://github.com/npm/npm-registry-fetch/blob/v19.1.1/lib/auth.js#L170
 */
export function setClientCertificate(
  env: NpmConfigEnv,
  registryUrl: string,
  certfile: string,
  keyfile: string
): void {
  const dart = nerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:certfile`] = certfile;
    env[`npm_config_${dart}:keyfile`] = keyfile;
  }
}

export function setCafile(env: NpmConfigEnv, path: string): void {
  env['npm_config_cafile'] = path;
}

export function setStrictSsl(env: NpmConfigEnv, value: boolean): void {
  // npm's env parser maps npm_config_strict_ssl -> strict-ssl.
  env['npm_config_strict_ssl'] = String(value);
}

export function setProxies(
  env: NpmConfigEnv,
  proxies: { httpProxy?: string; httpsProxy?: string; noProxy?: string }
): void {
  if (proxies.httpProxy) {
    env['npm_config_proxy'] = proxies.httpProxy;
  }
  if (proxies.httpsProxy) {
    env['npm_config_https_proxy'] = proxies.httpsProxy;
  }
  if (proxies.noProxy) {
    env['npm_config_noproxy'] = proxies.noProxy;
  }
}

/**
 * Directories above `root` (exclusive), nearest first, up to the filesystem
 * root. yarn classic and berry both read rc files from ancestor directories,
 * which npm never sees because its project-config walk stops at the first
 * package.json (the workspace root).
 */
export function ancestorDirectories(root: string): string[] {
  const dirs: string[] = [];
  let current = dirname(root);
  while (true) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return dirs;
}

const ENV_EXPR = /(?<!\\)(\\*)\$\{([^${}]+)\}/g;

function replaceEnvExpr(
  value: string,
  resolve: (name: string) => string | undefined
): string {
  return value.replace(ENV_EXPR, (orig: string, esc: string, name: string) => {
    // An odd run of backslashes escapes the reference. Leave the whole match
    // verbatim: npm applies the same escape rule to the env values we hand it,
    // so it consumes the backslashes and lands on the literal the workspace
    // package manager resolved. Consuming them here would expand it twice.
    if (esc.length % 2) {
      return orig;
    }
    return esc.slice(esc.length / 2) + (resolve(name) ?? `$\{${name}}`);
  });
}

const NPM_ENV_EXPR = /(?<!\\)(\\*)\$\{([^${}?]+)(\?)?\}/g;

/**
 * Resolves `${VAR}` references to the value npm itself ends up with, escapes
 * consumed and the `${VAR?}` form falling back to an empty string. Use it to
 * predict what a value npm reads for itself becomes, not to produce one for it:
 * a bridged value goes through npm's own pass, which expandEnvVars accounts for.
 * The `${VAR?}` form only landed in npm 11.6.0, so against an older spawned npm
 * the prediction resolves a reference that npm itself would leave verbatim.
 * See https://github.com/npm/cli/blob/v11.16.0/workspaces/config/lib/env-replace.js
 */
export function expandNpmEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return value.replace(
    NPM_ENV_EXPR,
    (orig: string, esc: string, name: string, optional: string) => {
      if (esc.length % 2) {
        return orig.slice((esc.length + 1) / 2);
      }
      const fallback = optional ? '' : `$\{${name}}`;
      return esc.slice(esc.length / 2) + (env[name] ?? fallback);
    }
  );
}

/**
 * Expands `${VAR}` references from the environment the way npm/bun ini readers
 * do. Unknown variables are left verbatim.
 */
export function expandEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return replaceEnvExpr(value, (name) => env[name]);
}

const PNPM_ENV_DEFAULT = /([^:-]+)(:?)-(.+)/;

/**
 * Expands `${VAR}` the way pnpm's @pnpm/config.env-replace does, which also
 * honors a `${VAR-default}` fallback and its `${VAR:-default}` form (that one
 * falls back for an empty value too, not just an unset one). A reference that
 * resolves to nothing becomes an empty string, matching the envReplaceLossy
 * reader pnpm has used since 11.2.0; keeping it verbatim would put a literal
 * `${VAR}` on the wire as if it were a credential.
 */
export function expandPnpmEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return replaceEnvExpr(value, (name) => {
    const matched = name.match(PNPM_ENV_DEFAULT);
    if (!matched) {
      return env[name] ?? '';
    }
    const [, variableName, colon, fallback] = matched;
    const resolved = env[variableName];
    if (resolved === undefined) {
      return fallback;
    }
    return !resolved && colon ? fallback : resolved;
  });
}

/** Case-tolerant read of an environment variable (exact, lower, upper). */
export function readEnvVar(
  env: NodeJS.ProcessEnv,
  name: string
): string | undefined {
  return env[name] ?? env[name.toLowerCase()] ?? env[name.toUpperCase()];
}

/**
 * Whether npm would find a credential for `dart` among the values `read`
 * exposes. npm strips one path segment at a time off the nerf-dart until only
 * the host is left, which covers the key spelled with and without its trailing
 * slash, and accepts a token, a basic `_auth`, a username/password pair, or a
 * client-certificate pair.
 * See https://github.com/npm/npm-registry-fetch/blob/v18.0.2/lib/auth.js#L16-L49
 */
export function hasCredentialFor(
  dart: string,
  read: (key: string) => string | undefined
): boolean {
  let regKey = dart;
  while (regKey.length > '//'.length) {
    if (
      read(`${regKey}:_authToken`) ||
      read(`${regKey}:_auth`) ||
      (read(`${regKey}:username`) && read(`${regKey}:_password`)) ||
      (read(`${regKey}:certfile`) && read(`${regKey}:keyfile`))
    ) {
      return true;
    }
    regKey = regKey.replace(/([^/]+|\/)$/, '');
  }
  return false;
}

let warnedNativeCredential = false;

/**
 * npm reads the user's own .npmrc chain and the overlay cannot switch that off,
 * so npm can authenticate on a registry the package manager resolved but would
 * have queried anonymously. The fetch still succeeds, so nothing else reports
 * it. Say it once, and only where the overlay is what sent npm to that registry:
 * left to itself npm would have used its own resolution and the same
 * credentials, which is what the user gets from npm anywhere else.
 *
 * `remediation` closes the message, because what the user can safely do about it
 * depends on whether the package manager reads .npmrc at all.
 */
export function warnNativeCredential(
  env: NpmConfigEnv,
  dart: string,
  packageManager: string,
  remediation: string,
  npmVisible: (key: string) => string | undefined
): void {
  if (
    warnedNativeCredential ||
    env['npm_config_registry'] === undefined ||
    // A credential the overlay carries is the package manager's own and
    // outranks the file, so npm sending it reproduces rather than diverges.
    hasCredentialFor(dart, (key) => env[`npm_config_${key}`]) ||
    !hasCredentialFor(dart, npmVisible)
  ) {
    return;
  }
  warnedNativeCredential = true;
  logger.warn(
    `npm will send the credential your .npmrc holds for ${dart} when fetching packages. ${packageManager} would not send it for this request. ${remediation}`
  );
}
