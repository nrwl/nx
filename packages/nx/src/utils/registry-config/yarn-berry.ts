import { existsSync } from 'fs';
import { minimatch } from 'minimatch';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { gte, lt, major } from 'semver';
import { readYamlFile } from '../fileutils';
import {
  ancestorDirectories,
  getPackageScope,
  setAuthIdent,
  setAuthToken,
  setCafile,
  setProxies,
  setRegistry,
  setScopedRegistry,
  setStrictSsl,
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
 * (global only).
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

interface BerryScopeEntry {
  npmRegistryServer?: string;
  npmAuthToken?: string;
  npmAuthIdent?: string;
  npmAlwaysAuth?: boolean;
}

const JSR_REGISTRY = 'https://npm.jsr.io';

interface BerryConfig {
  npmRegistryServer?: string;
  npmAuthToken?: string;
  npmAuthIdent?: string;
  npmAlwaysAuth?: boolean;
  caFilePath?: string;
  httpsCaFilePath?: string;
  enableStrictSsl?: boolean;
  httpProxy?: string;
  httpsProxy?: string;
  npmScopes?: Record<string, BerryScopeEntry>;
  npmRegistries?: Record<
    string,
    { npmAuthToken?: string; npmAuthIdent?: string; npmAlwaysAuth?: boolean }
  >;
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
    const merged: Record<string, string | boolean> = {};
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
  const registryEntryExists = rcFiles.some(
    (f) => lookupNpmRegistriesEntry(f.config, effectiveRegistry) !== undefined
  );
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
    alwaysAuth = scopeEntry.npmAlwaysAuth === true;
  } else if (registryEntryExists) {
    const registryEntry = resolveMapEntry((c) =>
      lookupNpmRegistriesEntry(c, effectiveRegistry)
    );
    authToken = registryEntry?.npmAuthToken;
    authIdent = registryEntry?.npmAuthIdent;
    alwaysAuth = registryEntry?.npmAlwaysAuth === true;
  } else {
    authToken =
      process.env['YARN_NPM_AUTH_TOKEN'] ??
      firstDefinedIn(rcFiles, (c) => c.npmAuthToken);
    authIdent =
      process.env['YARN_NPM_AUTH_IDENT'] ??
      firstDefinedIn(rcFiles, (c) => c.npmAuthIdent);
    alwaysAuth =
      process.env['YARN_NPM_ALWAYS_AUTH'] !== undefined
        ? process.env['YARN_NPM_ALWAYS_AUTH'] === 'true'
        : firstDefinedIn(rcFiles, (c) => c.npmAlwaysAuth) === true;
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

  applyTls(env, rcFiles, effectiveRegistry, yarnVersion);
  return env;
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
    try {
      const config = readYamlFile<BerryConfig>(path);
      if (config && typeof config === 'object') {
        files.push({ path, config });
      }
    } catch {
      // An unreadable rc file would abort berry itself; skip it here.
    }
  }
  return files;
}

/** npmRegistries keys may carry a protocol or start with `//`; both match. */
function lookupNpmRegistriesEntry(
  config: BerryConfig,
  registry: string
):
  | { npmAuthToken?: string; npmAuthIdent?: string; npmAlwaysAuth?: boolean }
  | undefined {
  if (!config.npmRegistries) {
    return undefined;
  }
  const normalized = registry.replace(/\/$/, '');
  // berry strips any scheme (not just http/https) when matching the entry key.
  const protocolStripped = normalized.replace(/^[a-z]+:/, '');
  for (const [key, value] of Object.entries(config.npmRegistries)) {
    const normalizedKey = key.replace(/\/$/, '');
    if (normalizedKey === normalized || normalizedKey === protocolStripped) {
      return value;
    }
  }
  return undefined;
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
  // v2/v3 use caFilePath; v4 renamed it to httpsCaFilePath (the wrong key for
  // the major makes berry itself abort, so a working workspace only has the
  // right one). Read both to stay version-tolerant.
  const caKeys: (keyof BerryConfig & ('caFilePath' | 'httpsCaFilePath'))[] =
    major(yarnVersion) >= 4
      ? ['httpsCaFilePath', 'caFilePath']
      : ['caFilePath', 'httpsCaFilePath'];

  let host: string | undefined;
  try {
    host = new URL(effectiveRegistry).hostname;
  } catch {}

  // Berry's getNetworkSettings fills each key independently from every glob that
  // matches the host (longest key first, first non-null wins). v4 merges a
  // per-host-key block across rc files per sub-key; v2/v3 keep the highest-
  // priority file's whole block. A networkSettings value overrides the global
  // key for that key only.
  const network = resolveNetworkSettings(
    rcFiles,
    host,
    major(yarnVersion) >= 4
  );

  let cafile: { value: string; baseDir: string } | undefined;
  for (const caKey of caKeys) {
    if (network[caKey]) {
      cafile = network[caKey];
      break;
    }
  }
  if (!cafile) {
    outer: for (const file of rcFiles) {
      for (const caKey of caKeys) {
        if (file.config[caKey]) {
          cafile = { value: file.config[caKey]!, baseDir: dirname(file.path) };
          break outer;
        }
      }
    }
  }

  const httpProxy = expandBerryValue(
    network.httpProxy ?? firstDefinedIn(rcFiles, (c) => c.httpProxy),
    legacy
  );
  const httpsProxy = expandBerryValue(
    network.httpsProxy ?? firstDefinedIn(rcFiles, (c) => c.httpsProxy),
    legacy
  );

  const envCaFile =
    process.env['YARN_HTTPS_CA_FILE_PATH'] ?? process.env['YARN_CA_FILE_PATH'];
  if (envCaFile) {
    setCafile(env, resolve(expandBerryEnvVars(envCaFile, legacy)));
  } else if (cafile) {
    // Berry expands env vars in path settings, then resolves relative to the rc
    // file's directory.
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
    httpProxy: process.env['YARN_HTTP_PROXY'] ?? httpProxy,
    httpsProxy: process.env['YARN_HTTPS_PROXY'] ?? httpsProxy,
  });
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
// are themselves merged across rc files (project-first per sub-key).
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
  for (const file of rcFiles) {
    const settings = file.config.networkSettings;
    if (!settings) {
      continue;
    }
    const baseDir = dirname(file.path);
    for (const [hostKey, entry] of Object.entries(settings)) {
      const existing = merged.get(hostKey);
      // v2/v3: the highest-priority file defining this glob owns the whole
      // entry, so a lower file never contributes a missing sub-key.
      if (existing && !deepMerge) {
        continue;
      }
      const m = existing ?? {};
      if (entry.caFilePath != null && m.caFilePath === undefined) {
        m.caFilePath = { value: entry.caFilePath, baseDir };
      }
      if (entry.httpsCaFilePath != null && m.httpsCaFilePath === undefined) {
        m.httpsCaFilePath = { value: entry.httpsCaFilePath, baseDir };
      }
      if (entry.httpProxy != null && m.httpProxy === undefined) {
        m.httpProxy = entry.httpProxy;
      }
      if (entry.httpsProxy != null && m.httpsProxy === undefined) {
        m.httpsProxy = entry.httpsProxy;
      }
      merged.set(hostKey, m);
    }
  }
  const matching = [...merged.entries()]
    .filter(([key]) => minimatch(host, key))
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

// Mirrors berry miscUtils.parseBoolean's false set for SettingsType.BOOLEAN
// (false/'false'/0/'0'); every other value (true/'true'/1/'1', ...) is truthy.
function isBerryFalseBoolean(value: unknown): boolean {
  return value === false || value === 0 || value === 'false' || value === '0';
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
