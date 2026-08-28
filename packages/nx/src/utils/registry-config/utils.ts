import { dirname } from 'path';
import { gte, parse } from 'semver';
import { logger } from '../logger';

// A value import would create a cycle with package-manager.ts.
import type { PackageManager } from '../package-manager';

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
 * path), e.g. `https://r.example.com/npm/` -> `//r.example.com/npm/`.
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
 * Where npm and pnpm both begin a lookup for `registry`, and what
 * registryKeysFor climbs from. Both append the trailing slash a registry path is
 * missing before darting (npm darts the request URI; pnpm does it in
 * getAuthHeaderByURI and pickSettingByUrl), so the walk starts at the request's
 * own directory and still reaches a setting pinned to `//h/api/npm/` for a
 * request to `https://h/api/npm`, which the plain dart begins above.
 *
 * A registry URL carrying a query or a fragment lands back on the plain dart:
 * npm builds its request URI by concatenation, so the package name joins the
 * query rather than the path, and its walk never reaches the deeper directory.
 */
export function requestNerfDart(registry: string): string | null {
  return nerfDart(registry.endsWith('/') ? registry : `${registry}/`);
}

/**
 * The setting name npm resolves an environment key to, null for a key npm does
 * not read.
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
 * The value npm resolves for `setting` out of an environment: the last non-empty
 * `npm_config_*` spelling wins (loadEnv). `setting` is the name npm looks the
 * value up under, so a scope npm rewrites (`@my_scope`) finds nothing.
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
 * Whether `setting` is one this module resolves on the package manager's behalf.
 * `userconfig` is deliberately absent: it selects npm's own config file rather
 * than a value the package manager resolves, and npm reading its own .npmrc is
 * outside what the overlay reproduces.
 */
function isBridgedSetting(setting: string): boolean {
  return (
    setting.startsWith('//') ||
    setting.endsWith(':registry') ||
    BRIDGED_SETTINGS.has(setting)
  );
}

/**
 * Merges an npm_config_* overlay into the environment for a spawned npm, leaving
 * one non-empty spelling per setting: the overlay's where it carries the setting,
 * otherwise the ambient one npm itself would resolve. npm reads its env tier
 * last-write-wins over the received key order, and both macOS `/bin/sh` and npm's
 * own shell launcher rebuild that order, so a setting left spelled two ways
 * (`NPM_CONFIG_REGISTRY` beside `npm_config_registry`) goes to whichever one they
 * emit last instead of to the value resolved here.
 *
 * `managerIgnoresEnv` says which settings the package manager resolves without
 * reading `npm_config_*`. Bridged settings it answers true for are dropped even
 * where the overlay claims nothing: npm's env tier sits above every file, so
 * leaving one in place stops npm from reaching the .npmrc chain the package
 * manager itself resolved from. Settings outside the bridged set stay ambient
 * either way.
 */
export function mergeNpmConfigEnv(
  baseEnv: NodeJS.ProcessEnv,
  overlay: NpmConfigEnv,
  managerIgnoresEnv: IgnoresNpmConfigEnv = IGNORES_NONE
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
    if (managerIgnoresEnv(setting) && isBridgedSetting(setting)) {
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

export type IgnoresNpmConfigEnv = (setting: string) => boolean;

const IGNORES_NONE: IgnoresNpmConfigEnv = () => false;
const IGNORES_ALL: IgnoresNpmConfigEnv = () => true;
// pnpm 11.6.0's readUrlScopedEnvConfig reads a `p?npm_config_//<dart>:<key>`
// entry from the environment again, except `:tokenHelper`, which it refuses to
// take from there. Named settings stay on pnpm's own `PNPM_CONFIG_*` prefix.
const IGNORES_ALL_BUT_URL_SCOPED: IgnoresNpmConfigEnv = (setting) =>
  !setting.startsWith('//') || setting.endsWith(':tokenHelper');

/**
 * The settings the package manager resolves without reading `npm_config_*`, as
 * a predicate over setting names. A bridged setting it returns true for is one
 * the spawned npm never receives from the ambient environment; settings outside
 * the bridged set it has no say over. pnpm reads them all up to 10.x and stops at 11.0.0,
 * which switched to its own `PNPM_CONFIG_*` prefix, except that 11.6.0 restored
 * the URL-scoped credential keys; yarn berry has never read any; npm reads them by
 * definition, and bun reads them for the settings this module bridges.
 *
 * An undetermined or unparseable version answers false for every setting:
 * bridging is skipped or falls open there anyway, so the ambient environment
 * stays as it is.
 */
export function ignoresNpmConfigEnv(
  packageManager: PackageManager,
  packageManagerVersion: string | null
): IgnoresNpmConfigEnv {
  const version = packageManagerVersion ? parse(packageManagerVersion) : null;
  if (!version) {
    return IGNORES_NONE;
  }
  switch (packageManager) {
    case 'npm':
    case 'bun':
      return IGNORES_NONE;
    case 'pnpm':
      if (version.major < 11) {
        return IGNORES_NONE;
      }
      return gte(version, '11.6.0') ? IGNORES_ALL_BUT_URL_SCOPED : IGNORES_ALL;
    case 'yarn':
      return version.major >= 2 ? IGNORES_ALL : IGNORES_NONE;
    default: {
      // A new PackageManager member fails typecheck here until classified above;
      // callers outside a fall-open catch keep the ambient env instead of throwing.
      const _exhaustive: never = packageManager;
      return IGNORES_NONE;
    }
  }
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

/**
 * Keyed on the registry's own directory rather than the parent a path missing
 * its trailing slash darts to, so two registries under one parent keep separate
 * keys instead of handing each other's credential out. The same holds for the
 * two sinks below.
 */
export function setAuthToken(
  env: NpmConfigEnv,
  registryUrl: string,
  token: string
): void {
  const dart = requestNerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:_authToken`] = token;
  }
}

/** `_auth` carries base64(user:pass). */
export function setAuthIdent(
  env: NpmConfigEnv,
  registryUrl: string,
  base64Ident: string
): void {
  const dart = requestNerfDart(registryUrl);
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
  const dart = requestNerfDart(registryUrl);
  if (dart) {
    env[`npm_config_${dart}:certfile`] = certfile;
    env[`npm_config_${dart}:keyfile`] = keyfile;
  }
}

export function setCafile(env: NpmConfigEnv, path: string): void {
  env['npm_config_cafile'] = path;
}

export function setStrictSsl(env: NpmConfigEnv, value: boolean): void {
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
 * Directories above `root` (exclusive), nearest first. yarn classic and berry
 * both read rc files from ancestor directories, which npm never sees because
 * its project-config walk stops at the first package.json.
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

interface ReplaceEnvExprOptions {
  /**
   * Leave a match an odd run of backslashes escaped whole, instead of dropping
   * half the run the way every one of these readers does. For a value bound for
   * the spawned npm: npm applies the same escape rule to what it receives, so
   * consuming the escape here would let it expand the reference after all.
   */
  keepEscaped?: boolean;
}

function replaceEnvExpr(
  value: string,
  resolve: (name: string) => string | undefined,
  { keepEscaped = false }: ReplaceEnvExprOptions = {}
): string {
  return value.replace(ENV_EXPR, (orig: string, esc: string, name: string) => {
    if (esc.length % 2) {
      return keepEscaped ? orig : orig.slice((esc.length + 1) / 2);
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
 * The value to bridge so that npm's own expansion produces `value`, for a
 * resolution that consumed the package manager's escapes rather than leaving
 * them for npm (a literal a reader never expanded, or an expander whose escape
 * rule is not npm's). Each reference gets an odd run of backslashes, which npm
 * halves back to what it started as. Only what npm's reader would act on is
 * escaped, so a `${` it leaves alone is not turned into a literal backslash.
 */
export function escapeNpmEnvExpr(value: string): string {
  return value.replace(
    NPM_ENV_EXPR,
    (_orig: string, esc: string, name: string, optional: string) =>
      `${'\\'.repeat(esc.length * 2 + 1)}$\{${name}${optional ?? ''}}`
  );
}

/**
 * Expands `${VAR}` references from the environment the way npm/bun ini readers
 * do. Unknown variables are left verbatim. The result is bridged, so an escaped
 * reference keeps its escape for the spawned npm to consume.
 */
export function expandEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return replaceEnvExpr(value, (name) => env[name], { keepEscaped: true });
}

const YARN_ENV_EXPR = /(\\*)\$\{([^}]+)\}/g;

/**
 * Expands `${VAR}` the way yarn classic's own envReplace does, which parts from
 * npm's on both halves of its escape rule: an odd run of backslashes keeps
 * every one of them along with the reference, and an even one drops all of them
 * rather than half. A reference it resolves nothing for aborts yarn, so it
 * throws here into the caller's fall-open.
 * See https://github.com/yarnpkg/yarn/blob/v1.22.22/src/registries/npm-registry.js
 */
export function expandYarnEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return value.replace(YARN_ENV_EXPR, (orig: string, esc: string, name) => {
    if (esc.length % 2) {
      return orig;
    }
    const resolved = env[name];
    if (resolved === undefined) {
      throw new Error(`Failed to replace env in config: ${orig}`);
    }
    return resolved;
  });
}

const PNPM_ENV_DEFAULT = /([^:-]+)(:?)-(.+)/;

/**
 * One `${...}` reference as pnpm's getEnvValue resolves it: the variable, or the
 * `${VAR-default}` fallback and its `${VAR:-default}` form, which falls back for
 * an empty value too and not just an unset one. Undefined for a reference pnpm
 * finds nothing for, which is what its two readers part ways over.
 */
function resolvePnpmEnvValue(
  name: string,
  env: NodeJS.ProcessEnv
): string | undefined {
  const matched = name.match(PNPM_ENV_DEFAULT);
  if (!matched) {
    return env[name];
  }
  const [, variableName, colon, fallback] = matched;
  const resolved = env[variableName];
  if (resolved === undefined) {
    return fallback;
  }
  return !resolved && colon ? fallback : resolved;
}

/**
 * Expands `${VAR}` the way pnpm's @pnpm/config.env-replace does. A reference
 * that resolves to nothing becomes an empty string, matching the envReplaceLossy
 * reader pnpm takes its config through from 11.0.0; keeping it verbatim would
 * put a literal `${VAR}` on the wire as if it were a credential. Below 11 the
 * reader throws instead and the whole file goes with it (readPnpmNpmrcMap), so
 * on that line nothing reaching this carries an unresolvable reference.
 *
 * This is what pnpm itself ends up with, escapes consumed. Use it for a key,
 * which nothing expands a second time, and for a value compared against pnpm's
 * own resolution; a value handed to the spawned npm goes through
 * bridgePnpmEnvVars instead.
 */
export function expandPnpmEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return replaceEnvExpr(value, (name) => resolvePnpmEnvValue(name, env) ?? '');
}

/**
 * The same expansion in the form to hand the spawned npm: every `${VAR}` left in
 * what pnpm resolved is escaped, so npm reproduces it instead of expanding a
 * reference pnpm would have sent literally, whether that reference is one pnpm
 * kept escaped or one a variable's own value carries.
 *
 * The escaping runs over pnpm's whole result rather than per reference, because
 * a resolved value ending in a backslash joins the escape run of the reference
 * behind it. Escaping each piece on its own leaves npm reading the merged run,
 * whose parity says expand where pnpm's said keep.
 */
export function bridgePnpmEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return escapeNpmEnvExpr(expandPnpmEnvVars(value, env));
}

/** The `${VAR}` references in `value` that pnpm's throwing reader dies on. */
export function unresolvedPnpmEnvVars(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const unresolved: string[] = [];
  replaceEnvExpr(value, (name) => {
    const resolved = resolvePnpmEnvValue(name, env);
    if (resolved === undefined) {
      unresolved.push(`$\{${name}}`);
    }
    return resolved ?? '';
  });
  return unresolved;
}

/** Whether every `${VAR}` in `value` is one pnpm's throwing reader gets past. */
export function pnpmEnvVarsResolve(
  value: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return unresolvedPnpmEnvVars(value, env).length === 0;
}

export function readEnvVar(
  env: NodeJS.ProcessEnv,
  name: string
): string | undefined {
  return env[name] ?? env[name.toLowerCase()] ?? env[name.toUpperCase()];
}

/**
 * Reads `map` under `setting`, matching how npm and pnpm both expand a `${VAR}`
 * in an .npmrc key before they look a value up under it; `setting` is already
 * the resolved form to match. Both readers assign in file order, so the last key
 * that `expand` turns into `setting` wins, a literal one included.
 */
export function readExpandedKey(
  map: Map<string, string>,
  setting: string,
  expand: (value: string) => string
): string | undefined {
  let matched: string | undefined;
  for (const [rawKey, value] of map) {
    const expanded = rawKey.includes('${') ? expand(rawKey) : rawKey;
    if (expanded === setting) {
      matched = value;
    }
  }
  return matched;
}

/**
 * The registry keys npm looks a setting up under for `dart`, nearest first: it
 * strips one path segment at a time until only the host is left, which covers
 * the key spelled with and without its trailing slash.
 * See https://github.com/npm/npm-registry-fetch/blob/v18.0.2/lib/auth.js#L16-L26
 */
export function registryKeysFor(dart: string): string[] {
  const keys: string[] = [];
  let regKey = dart;
  while (regKey.length > '//'.length) {
    keys.push(regKey);
    regKey = regKey.replace(/([^/]+|\/)$/, '');
  }
  return keys;
}

/**
 * Whether npm would find a credential for `dart` among the values `read`
 * exposes, at the dart or at any parent of it.
 * See https://github.com/npm/npm-registry-fetch/blob/v18.0.2/lib/auth.js#L34-L49
 */
export function hasCredentialFor(
  dart: string,
  read: (key: string) => string | undefined
): boolean {
  return registryKeysFor(dart).some(
    (regKey) =>
      read(`${regKey}:_authToken`) ||
      read(`${regKey}:_auth`) ||
      (read(`${regKey}:username`) && read(`${regKey}:_password`)) ||
      (read(`${regKey}:certfile`) && read(`${regKey}:keyfile`))
  );
}

const warnedNativeCredentials = new Set<string>();

/**
 * npm reads the user's own .npmrc chain and the overlay cannot switch that off,
 * so npm can authenticate on a registry the package manager resolved but would
 * have queried anonymously. The fetch still succeeds, so nothing else reports it.
 * Warn only where the overlay is what sent npm to that registry: left to itself
 * npm would have used its own resolution and the same credentials, which is what
 * the user gets from npm anywhere else.
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
  // Per registry: one migrate resolves several packages, and a scoped one can
  // send npm to a registry no earlier package reached.
  const warned = `${packageManager}\0${dart}`;
  if (
    warnedNativeCredentials.has(warned) ||
    env['npm_config_registry'] === undefined ||
    // A credential the overlay carries is the package manager's own and
    // outranks the file, so npm sending it reproduces rather than diverges.
    hasCredentialFor(dart, (key) => env[`npm_config_${key}`]) ||
    !hasCredentialFor(dart, npmVisible)
  ) {
    return;
  }
  warnedNativeCredentials.add(warned);
  logger.warn(
    `npm will send the credential your .npmrc holds for ${dart} when fetching packages. ${packageManager} would not send it for this request. ${remediation}`
  );
}
