import { existsSync } from 'fs';
import { minimatch } from 'minimatch';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { gte, lt, major } from 'semver';
import { readYamlFile } from '../fileutils';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import {
  ancestorDirectories,
  getPackageScope,
  nerfDart,
  readNpmConfigEnv,
  setAuthIdent,
  setAuthToken,
  setCafile,
  setProxies,
  setRegistry,
  setScopedRegistry,
  setStrictSsl,
  warnNativeCredential,
  type NpmConfigEnv,
} from './utils';

/*
 * yarn berry (2/3/4) registry resolution (verified on 2.4.2, 3.8.7, 4.16.0):
 *
 * - Sources, highest first: YARN_* env vars > project .yarnrc.yml > ancestor
 *   .yarnrc.yml files (closer dir wins) > ~/.yarnrc.yml > defaults
 *   (first-writer-wins for scalars; npmScopes/npmRegistries merge per entry).
 * - Fetch registry for @scope/pkg: npmScopes.<scope-without-@>.npmRegistryServer,
 *   else npmRegistryServer (default https://registry.yarnpkg.com).
 * - .npmrc files are completely ignored.
 *
 * Because npm-visible surfaces are irrelevant to berry, the resolved values
 * are always injected (default and, for scoped targets, the scoped key), so a
 * stray .npmrc cannot steer the spawned npm away from what berry would do.
 *
 * Auth (npmAuthToken/npmAuthIdent at scope > npmRegistries[registry] > global)
 * lives in .yarnrc.yml, which npm cannot read; it is translated to nerf-darted
 * npm keys. TLS: caFilePath (v2/3) / httpsCaFilePath (v4), per-host
 * networkSettings (hostname globs, longest key first), enableStrictSsl
 * (global only). A matching networkSettings entry is read before the global
 * value of the same key, so for those keys alone it outranks the env vars too.
 *
 * See https://github.com/yarnpkg/berry/blob/a26895a80d2784a5be92c54d5e7622bc9b0864a5/packages/yarnpkg-core/sources/Configuration.ts#L1424
 */

const BERRY_DEFAULT_REGISTRY = 'https://registry.yarnpkg.com';

// Berry rewrote its env-var expander in 4.13.0, tightening the variable-name
// class from [\d\w_]+ (a leading _ or digit is valid) to [a-zA-Z]\w*. Below this
// version the legacy parser applies.
const BERRY_ENV_PARSER_REWRITE = '4.13.0';

interface BerryRcFile {
  path: string;
  config: BerryConfig;
}

/**
 * A berry Boolean setting as it reaches us: YAML yields `true`/`false` but also
 * `1`/`0` and the quoted forms, and an env-sourced value is always a string.
 * Berry coerces at read time (miscUtils.parseBoolean), so the raw shape is kept.
 */
type BerryBoolean = boolean | number | string;

interface BerryScopeEntry {
  npmRegistryServer?: string;
  npmAuthToken?: string;
  npmAuthIdent?: string;
  npmAlwaysAuth?: BerryBoolean;
}

interface BerryRegistryEntry {
  npmAuthToken?: string;
  npmAuthIdent?: string;
  npmAlwaysAuth?: BerryBoolean;
}

const JSR_REGISTRY = 'https://npm.jsr.io';

interface BerryConfig {
  npmRegistryServer?: string;
  npmAuthToken?: string;
  npmAuthIdent?: string;
  npmAlwaysAuth?: BerryBoolean;
  caFilePath?: string;
  httpsCaFilePath?: string;
  enableStrictSsl?: BerryBoolean;
  httpProxy?: string;
  httpsProxy?: string;
  npmScopes?: Record<string, BerryScopeEntry>;
  npmRegistries?: Record<string, BerryRegistryEntry>;
  networkSettings?: Record<
    string,
    {
      caFilePath?: string;
      httpsCaFilePath?: string;
      httpProxy?: string;
      httpsProxy?: string;
    }
  >;
}

export function getYarnBerrySpawnRegistryEnv(
  packageName: string,
  root: string,
  yarnVersion: string
): NpmConfigEnv {
  const env: NpmConfigEnv = {};
  const scope = getPackageScope(packageName);
  const rcFiles = collectRcFiles(root);
  // berry v4 deep-merges map settings (npmScopes/npmRegistries/networkSettings)
  // per sub-key across rc files; v2/v3 merge them whole-entry (the highest-
  // priority file that defines a key contributes its entire entry, omitted
  // sub-keys included as their defaults), so a split-across-files entry never
  // mixes. resolveMapEntry honors that difference.
  const deepMerge = major(yarnVersion) >= 4;
  const resolveMapEntry = (
    pick: (c: BerryConfig) => BerryScopeEntry | undefined
  ): BerryScopeEntry | undefined => {
    if (!deepMerge) {
      return firstDefinedIn(rcFiles, pick);
    }
    const merged: Record<string, BerryBoolean> = {};
    let any = false;
    for (const key of [
      'npmRegistryServer',
      'npmAuthToken',
      'npmAuthIdent',
      'npmAlwaysAuth',
    ] as const) {
      const value = firstDefinedIn(rcFiles, (c) => pick(c)?.[key]);
      if (value !== undefined) {
        merged[key] = value;
        any = true;
      }
    }
    return any ? (merged as BerryScopeEntry) : undefined;
  };

  // Berry env-expands ${VAR}/${VAR-default}/${VAR:-default} in every string
  // setting at parse time, so expand before any URL parse / nerf-dart / base64
  // (e.g. `npmRegistryServer: "${MY_REGISTRY}"` must resolve to the real host or
  // its auth/TLS keys are never emitted). The 4.13 parser rewrite changed which
  // names are valid, so pick the parser that matches the running version.
  const legacy = lt(yarnVersion, BERRY_ENV_PARSER_REWRITE);
  const defaultRegistry = expandBerryEnvVars(
    process.env['YARN_NPM_REGISTRY_SERVER'] ??
      firstDefinedIn(rcFiles, (c) => c.npmRegistryServer) ??
      BERRY_DEFAULT_REGISTRY,
    legacy
  );
  // npmScopes keys are scope names without the leading @.
  const scopeName = scope?.slice(1);
  const scopeEntry = scopeName
    ? resolveMapEntry((c) => c.npmScopes?.[scopeName])
    : undefined;
  // A *configured* scope (its key is present in npmScopes, even auth-only or
  // empty) whose npmRegistryServer is omitted routes to berry's SHAPE default
  // (registry.yarnpkg.com), NOT the top-level npmRegistryServer. Berry seeds
  // the scope's npmRegistryServer to that default and returns it directly. An
  // unconfigured scope falls through to the top-level default.
  const scopeConfigured =
    scopeName !== undefined &&
    rcFiles.some(
      (f) => f.config.npmScopes !== undefined && scopeName in f.config.npmScopes
    );
  // berry >= 4.9.0 seeds an unconfigured `jsr` scope to https://npm.jsr.io.
  const jsrDefault =
    scopeName === 'jsr' && !scopeConfigured && gte(yarnVersion, '4.9.0');
  const effectiveRegistry = scopeConfigured
    ? expandBerryEnvVars(
        scopeEntry?.npmRegistryServer ?? BERRY_DEFAULT_REGISTRY,
        legacy
      )
    : jsrDefault
      ? JSR_REGISTRY
      : defaultRegistry;

  setRegistry(env, defaultRegistry);
  if (scope) {
    setScopedRegistry(env, scope, effectiveRegistry);
  }

  // Auth: berry's getAuthConfiguration selects ONE config object by specificity
  // (scope if it carries a token OR ident, else the npmRegistries entry for the
  // effective registry IF one EXISTS, else the global config which folds in the
  // YARN_NPM_AUTH_* env), then reads token-then-ident from that single object.
  // A present-but-credential-less npmRegistries entry stops the search: berry
  // emits no auth rather than falling back to the global/env credentials.
  const registryKey = selectNpmRegistriesKey(rcFiles, effectiveRegistry);
  let authToken: string | undefined;
  let authIdent: string | undefined;
  // npmAlwaysAuth (default false) of the SELECTED auth config object; it gates
  // whether an unscoped fetch authenticates at all.
  let alwaysAuth = false;
  if (
    scopeEntry?.npmAuthToken !== undefined ||
    scopeEntry?.npmAuthIdent !== undefined
  ) {
    authToken = scopeEntry.npmAuthToken;
    authIdent = scopeEntry.npmAuthIdent;
    alwaysAuth = isBerryTrueBoolean(scopeEntry.npmAlwaysAuth);
  } else if (registryKey !== undefined) {
    const registryEntry = resolveMapEntry(
      (c) => c.npmRegistries?.[registryKey]
    );
    authToken = registryEntry?.npmAuthToken;
    authIdent = registryEntry?.npmAuthIdent;
    alwaysAuth = isBerryTrueBoolean(registryEntry?.npmAlwaysAuth);
  } else {
    authToken =
      process.env['YARN_NPM_AUTH_TOKEN'] ??
      firstDefinedIn(rcFiles, (c) => c.npmAuthToken);
    authIdent =
      process.env['YARN_NPM_AUTH_IDENT'] ??
      firstDefinedIn(rcFiles, (c) => c.npmAuthIdent);
    alwaysAuth = isBerryTrueBoolean(
      process.env['YARN_NPM_ALWAYS_AUTH'] ??
        firstDefinedIn(rcFiles, (c) => c.npmAlwaysAuth)
    );
  }
  // Expand ${VAR} before use so the npmAuthIdent base64 decision (made on the
  // presence of a `:`) and the bridged value are computed on the real
  // credentials, matching berry. Env-sourced values are literal (no-op).
  authToken = expandBerryValue(authToken, legacy);
  authIdent = expandBerryValue(authIdent, legacy);

  // A scoped fetch authenticates (berry forces BEST_EFFORT); an unscoped fetch
  // only when npmAlwaysAuth is set on the selected config (npm view/pack leaves
  // berry's authType at CONFIGURATION).
  if (scope || alwaysAuth) {
    if (authToken) {
      setAuthToken(env, effectiveRegistry, authToken);
    } else if (authIdent) {
      setAuthIdent(env, effectiveRegistry, encodeIdent(authIdent, yarnVersion));
    }
  }

  // berry never reads an .npmrc, so any credential one holds for the registry
  // berry resolved is one berry itself would never send. Unlike yarn classic
  // there is no gate to consult: whatever berry would send is already in the
  // overlay, which the warning checks for.
  const dart = nerfDart(effectiveRegistry);
  if (dart) {
    warnNativeCredential(
      env,
      dart,
      'yarn',
      // Safe to say outright here: berry reads no .npmrc, so nothing yarn does
      // depends on that credential.
      'Remove that credential from .npmrc if npm should not authenticate there; yarn never reads that file.',
      (key) => readNpmConfigEnv(process.env, key) ?? npmrcValue(root, key)
    );
  }

  applyTls(env, rcFiles, effectiveRegistry, yarnVersion);
  return env;
}

// The .npmrc files npm reads for itself and berry ignores. npm also reads a
// <globalPrefix>/etc npmrc and its own builtin one, which are not enumerated
// here: missing one only means the warning stays silent.
function npmrcValue(root: string, key: string): string | undefined {
  for (const path of [join(root, '.npmrc'), join(homedir(), '.npmrc')]) {
    const value = readNpmrcMap(path)?.get(key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function collectRcFiles(root: string): BerryRcFile[] {
  const rcName = process.env['YARN_RC_FILENAME'] ?? '.yarnrc.yml';
  const paths = [
    join(root, rcName),
    ...ancestorDirectories(root).map((dir) => join(dir, rcName)),
    join(homedir(), rcName),
  ];
  const files: BerryRcFile[] = [];
  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }
    // An unreadable, corrupt or non-mapping rc file aborts yarn itself, so there
    // is no resolution left to reproduce. Every shape propagates to the caller's
    // fall-open; dropping the file instead would resolve to berry's default
    // registry while still bridging the credentials the other files declare.
    let config: BerryConfig;
    try {
      // berry loads its rc files through @yarnpkg/parsers, which calls js-yaml
      // with the failsafe schema and json: true. That combination is what makes
      // `npmAuthToken: 12345` a string and a repeated key last-wins rather than
      // an error, so read them the same way instead of re-typing the scalars.
      config = readYamlFile<BerryConfig>(path, { json: true, failsafe: true });
    } catch {
      // The parse error quotes the lines around the fault, which in an rc file
      // is credential material, and the caller logs whatever reaches it.
      throw new Error(`The yarn rc file at ${path} could not be read.`);
    }
    // An empty or comment-only file is a valid rc that declares nothing.
    if (config === undefined || config === null) {
      continue;
    }
    if (typeof config !== 'object' || Array.isArray(config)) {
      throw new Error(`The yarn rc file at ${path} is not a settings mapping.`);
    }
    normalizeMapSettings(config, path);
    files.push({ path, config });
  }
  return files;
}

/**
 * Berry types npmScopes/npmRegistries/networkSettings and their entries, and
 * rejects the wrong shape before it resolves anything: a null is tolerated (that
 * level keeps its defaults) but any other non-object aborts yarn with "must be
 * an object". Reproduce both, so a config berry refuses to run on never reads as
 * if berry had accepted it, and the tolerated shape stops reaching the lookups
 * below as a null. Verified on 3.8.7 and 4.15.0.
 */
function normalizeMapSettings(config: BerryConfig, path: string): void {
  config.npmScopes = normalizeMapSetting(config.npmScopes, 'npmScopes', path);
  // npmRegistries is declared with normalizeKeys, so berry strips the trailing
  // slash off each key as it loads the map; do it here rather than at every
  // lookup, and let a colliding key win last the way berry's Map does.
  const registries = normalizeMapSetting(
    config.npmRegistries,
    'npmRegistries',
    path
  );
  config.npmRegistries = registries
    ? Object.fromEntries(
        Object.entries(registries).map(([key, entry]) => [
          normalizeRegistryKey(key),
          entry,
        ])
      )
    : undefined;
  config.networkSettings = normalizeMapSetting(
    config.networkSettings,
    'networkSettings',
    path
  );
}

function normalizeMapSetting<T extends object>(
  map: Record<string, T> | undefined,
  setting: string,
  path: string
): Record<string, T> | undefined {
  const entries = asBerryObject<Record<string, T>>(map, setting, path);
  if (!entries) {
    return undefined;
  }
  for (const key of Object.keys(entries)) {
    // A null entry is still a configured key, with every sub-setting defaulted.
    entries[key] =
      asBerryObject<T>(entries[key], `${setting}["${key}"]`, path) ?? ({} as T);
  }
  return entries;
}

function asBerryObject<T extends object>(
  value: unknown,
  setting: string,
  path: string
): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `The yarn setting "${setting}" in ${path} is not an object.`
    );
  }
  return value as T;
}

/**
 * Berry looks the effective registry up in its merged npmRegistries map by exact
 * key first and only then with the scheme stripped, so the key has to be picked
 * across every rc file before any entry is read: an exact key in the home rc
 * still beats a scheme-less one in the project rc.
 */
function selectNpmRegistriesKey(
  rcFiles: BerryRcFile[],
  registry: string
): string | undefined {
  const exact = normalizeRegistryKey(registry);
  // berry strips any scheme (not just http/https) for the second lookup.
  for (const key of [exact, exact.replace(/^[a-z]+:/, '')]) {
    if (rcFiles.some((f) => f.config.npmRegistries?.[key] !== undefined)) {
      return key;
    }
  }
  return undefined;
}

/** Berry's normalizeRegistry, which it also applies to every npmRegistries key. */
function normalizeRegistryKey(registry: string): string {
  return registry.replace(/\/$/, '');
}

/**
 * npm's `_auth` is base64(user:pass). Berry v2 stores npmAuthIdent already
 * base64-encoded; v3/v4 accept both and base64-encode at request time only
 * when the value still contains a `:`.
 */
function encodeIdent(ident: string, yarnVersion: string): string {
  if (major(yarnVersion) >= 3 && ident.includes(':')) {
    return Buffer.from(ident).toString('base64');
  }
  return ident;
}

function applyTls(
  env: NpmConfigEnv,
  rcFiles: BerryRcFile[],
  effectiveRegistry: string,
  yarnVersion: string
): void {
  const legacy = lt(yarnVersion, BERRY_ENV_PARSER_REWRITE);
  const v4 = major(yarnVersion) >= 4;
  // v2/v3 name the CA setting caFilePath, v4 renamed it to httpsCaFilePath. The
  // other major's name aborts berry, as an rc setting and as a YARN_* env var
  // alike, so only the name the running major accepts describes a resolution
  // there is anything left to reproduce.
  const caKey = v4 ? 'httpsCaFilePath' : 'caFilePath';
  const caEnvKey = v4 ? 'YARN_HTTPS_CA_FILE_PATH' : 'YARN_CA_FILE_PATH';

  let host: string | undefined;
  try {
    host = new URL(effectiveRegistry).hostname;
  } catch {}

  // Berry's getNetworkSettings fills each key independently from every glob that
  // matches the host (longest key first, first non-null wins) and only then
  // falls back to the global setting, so a per-host entry outranks the YARN_*
  // env vars while those still outrank the rc files. v4 merges a per-host-key
  // block across rc files per sub-key; v2/v3 keep the highest-priority file's
  // whole block.
  const network = resolveNetworkSettings(rcFiles, host, v4);

  // Berry expands env vars in path settings, then resolves an rc-sourced path
  // relative to that rc file's directory and an env-sourced one relative to the
  // directory yarn was invoked from.
  const cafile =
    network[caKey] ??
    envPath(process.env[caEnvKey]) ??
    firstPathIn(rcFiles, caKey);
  if (cafile) {
    setCafile(
      env,
      resolve(cafile.baseDir, expandBerryEnvVars(cafile.value, legacy))
    );
  }

  const strictSsl =
    process.env['YARN_ENABLE_STRICT_SSL'] ??
    firstDefinedIn(rcFiles, (c) => c.enableStrictSsl);
  if (strictSsl !== undefined) {
    setStrictSsl(env, !isBerryFalseBoolean(strictSsl));
  }

  setProxies(env, {
    httpProxy: expandBerryValue(
      network.httpProxy ??
        process.env['YARN_HTTP_PROXY'] ??
        firstDefinedIn(rcFiles, (c) => c.httpProxy),
      legacy
    ),
    httpsProxy: expandBerryValue(
      network.httpsProxy ??
        process.env['YARN_HTTPS_PROXY'] ??
        firstDefinedIn(rcFiles, (c) => c.httpsProxy),
      legacy
    ),
  });
}

function envPath(value: string | undefined): NetworkPath | undefined {
  return value ? { value, baseDir: process.cwd() } : undefined;
}

function firstPathIn(
  rcFiles: BerryRcFile[],
  key: 'caFilePath' | 'httpsCaFilePath'
): NetworkPath | undefined {
  for (const file of rcFiles) {
    const value = file.config[key];
    if (value) {
      return { value, baseDir: dirname(file.path) };
    }
  }
  return undefined;
}

interface NetworkPath {
  value: string;
  baseDir: string;
}
interface ResolvedNetwork {
  caFilePath?: NetworkPath;
  httpsCaFilePath?: NetworkPath;
  httpProxy?: string;
  httpsProxy?: string;
}

// Reproduces berry getNetworkSettings: each network key is filled from the first
// (longest-glob-first) matching host entry that defines it; per-host-key blocks
// are themselves merged across rc files. Berry builds that merged map lowest
// priority first, and its sort is stable, so two globs of equal length are
// consulted in that same order.
function resolveNetworkSettings(
  rcFiles: BerryRcFile[],
  host: string | undefined,
  deepMerge: boolean
): ResolvedNetwork {
  const result: ResolvedNetwork = {};
  if (!host) {
    return result;
  }
  const merged = new Map<string, ResolvedNetwork>();
  for (const file of [...rcFiles].reverse()) {
    const settings = file.config.networkSettings;
    if (!settings) {
      continue;
    }
    const baseDir = dirname(file.path);
    for (const [hostKey, entry] of Object.entries(settings)) {
      // Walking lowest priority first, a later file is the higher-priority one:
      // under v4 each sub-key it defines wins, and under v2/v3 it owns the whole
      // entry, so a lower file never contributes a missing sub-key there.
      const m = (deepMerge && merged.get(hostKey)) || {};
      if (entry.caFilePath != null) {
        m.caFilePath = { value: entry.caFilePath, baseDir };
      }
      if (entry.httpsCaFilePath != null) {
        m.httpsCaFilePath = { value: entry.httpsCaFilePath, baseDir };
      }
      if (entry.httpProxy != null) {
        m.httpProxy = entry.httpProxy;
      }
      if (entry.httpsProxy != null) {
        m.httpsProxy = entry.httpsProxy;
      }
      merged.set(hostKey, m);
    }
  }
  const matching = [...merged.entries()]
    .filter(([key]) => matchesHostGlob(host, key))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([, m]) => m);
  for (const m of matching) {
    result.caFilePath ??= m.caFilePath;
    result.httpsCaFilePath ??= m.httpsCaFilePath;
    result.httpProxy ??= m.httpProxy;
    result.httpsProxy ??= m.httpsProxy;
  }
  return result;
}

/**
 * Berry matches a networkSettings key against the hostname with micromatch,
 * which parses two forms differently from minimatch: a bare `(a|b)` is an
 * extglob alternation rather than literal parentheses, and a leading `!` negates
 * the pattern only when it is not the start of a `!(...)` extglob. Left to
 * minimatch a `!(...)` key matches nearly every host, which would hand one
 * host's CA and proxy to the registry.
 */
function matchesHostGlob(host: string, key: string): boolean {
  return minimatch(host, key.replace(/(^|[^\\@!+*?])\(/g, '$1@('), {
    nonegate: key.startsWith('!('),
  });
}

// Berry's miscUtils.replaceEnvVariables, applied to every string setting:
// ${VAR}, ${VAR-default} (default when unset), and ${VAR:-default} (default
// when unset or empty), then bridged. Berry throws on an undefined bare ${VAR}
// (which aborts berry itself, so a working workspace never has one); we leave
// such a reference literal rather than failing the migrate. 4.13.0 rewrote the
// parser, so dispatch to the one matching the running version.
// see https://github.com/yarnpkg/berry/blob/c5857bdee5737425b879492db5e2732a5e6e14f2/packages/yarnpkg-core/sources/miscUtils.ts#L473
function expandBerryEnvVars(
  value: string,
  legacy: boolean,
  env: NodeJS.ProcessEnv = process.env
): string {
  return legacy
    ? expandBerryEnvVarsLegacy(value, env)
    : scanBerryEnv(value, 0, env, false).text;
}

// Berry < 4.13 expanded env vars with a single regex, where one leading
// backslash escapes the reference.
// See https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/4.12.0/packages/yarnpkg-core/sources/miscUtils.ts
function expandBerryEnvVarsLegacy(
  value: string,
  env: NodeJS.ProcessEnv
): string {
  return value.replace(
    /\\?\$\{(?<variableName>[\d\w_]+)(?<colon>:)?(?:-(?<fallback>[^}]*))?\}/g,
    (match, ...args) => {
      if (match.startsWith('\\')) {
        return match.slice(1);
      }
      const { variableName, colon, fallback } = args[args.length - 1] as {
        variableName: string;
        colon?: string;
        fallback?: string;
      };
      const resolved = env[variableName];
      if (resolved || (Object.hasOwn(env, variableName) && !colon)) {
        return resolved as string;
      }
      return fallback ?? match;
    }
  );
}

// Scans from `start`, expanding env-var references. When `nested` is set the
// scan also stops just after the unescaped `}` that closes an enclosing default.
function scanBerryEnv(
  input: string,
  start: number,
  env: NodeJS.ProcessEnv,
  nested: boolean
): { text: string; end: number } {
  let text = '';
  let i = start;
  while (i < input.length) {
    const c = input[i];
    if (c === '\\' && i + 1 < input.length && '\\$}'.includes(input[i + 1])) {
      text += input[i + 1];
      i += 2;
    } else if (nested && c === '}') {
      return { text, end: i + 1 };
    } else if (c === '$' && input[i + 1] === '{') {
      const ref = parseBerryRef(input, i, env);
      if (ref) {
        text += ref.text;
        i = ref.end;
      } else {
        // Malformed `${...` (berry would throw); emit it literally and continue.
        text += '${';
        i += 2;
      }
    } else {
      text += c;
      i += 1;
    }
  }
  return { text, end: i };
}

// Parses one ${NAME} / ${NAME-default} / ${NAME:-default} at `start` (where
// input[start] === '$' and input[start + 1] === '{'). The default is parsed
// brace-balanced so a nested ${...} is captured whole. Returns null when the
// reference is malformed (invalid name or no operator/close).
function parseBerryRef(
  input: string,
  start: number,
  env: NodeJS.ProcessEnv
): { text: string; end: number } | null {
  const nameMatch = input.slice(start + 2).match(/^[a-zA-Z]\w*/);
  if (!nameMatch) {
    return null;
  }
  const name = nameMatch[0];
  let i = start + 2 + name.length;
  const value = env[name];
  if (input[i] === '}') {
    // ${NAME}: an undefined value aborts berry; leave the reference literal.
    return {
      text: value !== undefined ? value : input.slice(start, i + 1),
      end: i + 1,
    };
  }
  let emptyIsUnset = false;
  if (input[i] === ':' && input[i + 1] === '-') {
    emptyIsUnset = true;
    i += 2;
  } else if (input[i] === '-') {
    i += 1;
  } else {
    return null;
  }
  // Parse (and expand) the default region even when the value wins, so `end`
  // skips past the matching close brace.
  const fallback = scanBerryEnv(input, i, env, true);
  const useValue = emptyIsUnset
    ? value !== undefined && value !== ''
    : value !== undefined;
  return {
    text: useValue ? (value as string) : fallback.text,
    end: fallback.end,
  };
}

// Berry's miscUtils.parseBoolean false set for SettingsType.BOOLEAN.
function isBerryFalseBoolean(value: unknown): boolean {
  return value === false || value === 0 || value === 'false' || value === '0';
}

// Its true set. Berry throws on a value in neither, which aborts berry itself,
// so each side keeps the tolerance that is safe for its setting: an unparseable
// enableStrictSsl keeps TLS verification on, an unparseable npmAlwaysAuth leaves
// an unscoped fetch unauthenticated.
function isBerryTrueBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1';
}

/** Expands ${VAR} in an optional berry string value, passing undefined through. */
function expandBerryValue(
  value: string | undefined,
  legacy: boolean
): string | undefined {
  return value === undefined ? undefined : expandBerryEnvVars(value, legacy);
}

function firstDefinedIn<T>(
  rcFiles: BerryRcFile[],
  read: (config: BerryConfig) => T | undefined
): T | undefined {
  for (const file of rcFiles) {
    const value = read(file.config);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}
