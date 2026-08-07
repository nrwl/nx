import { existsSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { gte, lt } from 'semver';
import {
  getPnpmConfigDir,
  readPnpmYamlConfig,
} from '../package-manager-config/pnpm-config';
import {
  npmrcEntriesToMap,
  readNpmrcEntries,
  type NpmrcEntry,
} from '../package-manager-config/npmrc';
import { fileExists } from '../fileutils';
import { logger } from '../logger';
import {
  ancestorDirectories,
  escapeNpmEnvExpr,
  expandNpmEnvVars,
  expandPnpmEnvVars,
  getPackageScope,
  hasCredentialFor,
  ignoresNpmConfigEnv,
  nerfDart,
  pnpmEnvVarsResolve,
  readEnvVar,
  readExpandedKey,
  readNpmConfigEnv,
  registryKeysFor,
  setCafile,
  setProxies,
  setRegistry,
  setScopedRegistry,
  setStrictSsl,
  type IgnoresNpmConfigEnv,
  type NpmConfigEnv,
} from './utils';

/*
 * pnpm registry resolution, by version line:
 *
 * - < 10.6.0: registry config lives only in the .npmrc chain and npm_config_*
 *   env vars, which a spawned npm resolves identically on its own. Nothing to
 *   bridge.
 * - 10.6.0 - 10.x: pnpm-workspace.yaml accepts every .npmrc setting in
 *   camelCase (https://github.com/pnpm/pnpm/pull/9211) and the parsed yaml
 *   object is Object.assign-ed over the npmrc-derived config, so a
 *   `registries` map (default/@scope keys) wholesale-replaces the
 *   npmrc/env/CLI registry selection. That config keeps npm's own tiers plus a
 *   `workspace` one, the .npmrc beside the workspace manifest, ranked under the
 *   project .npmrc and over the user one.
 * - >= 11.0.0: the config reader merges per key: registries =
 *   {...fromNpmrc, ...fromYaml}, then `pnpm_config_registry` env overrides
 *   only `registries.default`. npm_config_* env vars are no longer read (11.6.0
 *   restores the URL-scoped `//<dart>:<key>` ones alone), and .npmrc is
 *   restricted to auth/registry/network keys. The per-package lookup is
 *   registries[scope] ?? registries.default. An `auth.ini` file in pnpm's
 *   config dir layers between the user and workspace .npmrc. Because pnpm
 *   ignores npm_config_* here, the overlay this builds is consumed by the
 *   spawned `npm pack` (and a forced `npm view`), not by `pnpm view`, which
 *   resolves natively.
 * - >= 11.10.0: a JSON auth tier (`pnpm_config__auth` env over the global
 *   config.yaml `_auth`) layers credentials above the URL-scoped env tier and
 *   registries above the yaml.
 */

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
const BARE_AUTH_KEYS = [
  '_authToken',
  '_auth',
  'username',
  '_password',
] as const;
// pnpm's UNSCOPED_RESCOPABLE_KEYS: the credentials above plus the client TLS
// material and the helper, all of which it pins to the declaring file's own
// registry rather than leaving unscoped.
const PNPM_RESCOPABLE_KEYS = [
  ...BARE_AUTH_KEYS,
  'tokenHelper',
  'cert',
  'key',
] as const;

interface PnpmWorkspaceSettings {
  // pnpm type-checks neither of these, and reacts to a wrong shape rather than
  // rejecting it, so each stays unknown for the consumer that narrows it.
  registries?: unknown;
  strictSsl?: unknown;
  registry?: string;
  proxy?: string;
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
  // The one key here pnpm also answers to in npm's spelling. Its siblings are
  // camelCase-only, so nothing else needs an alias.
  noproxy?: string;
  ca?: string;
  cert?: string;
  key?: string;
}

export function getPnpmSpawnRegistryEnv(
  packageName: string,
  root: string,
  pnpmVersion: string | null
): NpmConfigEnv {
  const env: NpmConfigEnv = {};
  // Which surfaces this pnpm honors depends on the version, so an undetermined
  // one bridges nothing.
  if (!pnpmVersion || lt(pnpmVersion, '10.6.0')) {
    return env;
  }

  const workspaceFile = findPnpmWorkspaceFile(root, pnpmVersion);
  const settings = readPnpmWorkspaceSettings(workspaceFile, pnpmVersion);
  const scope = getPackageScope(packageName);
  // Kept identical to the predicate the caller hands mergeNpmConfigEnv at spawn
  // time, which drops the bridged ambient npm_config_* this answers true for
  // (settings outside the bridged set stay ambient either way).
  const managerIgnoresEnv = ignoresNpmConfigEnv('pnpm', pnpmVersion);

  if (lt(pnpmVersion, '11.0.0')) {
    // The replace wipes the npmrc/env/CLI selection outright, so the scoped key
    // is forced to the yaml default when the map has no entry for the scope. A
    // scoped-only map leaves pnpm no default at all, which crashes it on an
    // unscoped target but resolves a scoped one fine, so npm's own default is
    // left in place rather than aimed at a registry pnpm uses only for that
    // scope.
    const yamlDefault = pickYamlRegistry(settings, 'default', workspaceFile);
    if (yamlDefault) {
      setRegistry(env, yamlDefault);
    }
    const pick = scope
      ? (pickYamlRegistry(settings, scope, workspaceFile) ?? yamlDefault)
      : undefined;
    if (scope && pick) {
      setScopedRegistry(env, scope, pick);
    }
    // Both .npmrc files pnpm reads here, project first, which is the order both
    // the bridge and the bypass list resolve them in.
    const npmrcPaths = pnpmNpmrcPaths(root, workspaceFile);
    const npmrcProxies = bridgeWorkspaceNpmrc(
      env,
      npmrcPaths,
      scope,
      pnpmVersion
    );
    // auth.ini is an 11.x file, so these are the only layers whose bypass list
    // can need re-spelling here.
    bridgeNoProxy(env, npmrcPaths, pnpmVersion);
    // Applied last: pnpm assigns the yaml over the whole npmrc-derived config,
    // so what it declares outranks everything the files above contributed.
    applyYamlNetworkSettings(env, settings);
    applyResolvedProxies(
      env,
      [settings, npmrcProxies],
      root,
      scope,
      managerIgnoresEnv
    );
    // On this version line pnpm's user config is npm's own (no auth.ini, no
    // npmrcAuthFile), always a file npm reads for itself.
    reportTokenHelper(
      env,
      root,
      scope,
      getNpmUserConfigPath(root),
      pnpmVersion,
      managerIgnoresEnv
    );
    return env;
  }

  // The yaml-only keys go in at npm's env tier, where npm's per-key chain
  // reproduces pnpm's ordering: a project .npmrc @scope:registry still beats an
  // injected default, while an injected @scope:registry beats the project
  // .npmrc scoped key (yaml @scope > npmrc @scope in pnpm). JSON-auth
  // registries sit above the yaml and below the named env registry, which pnpm
  // applies onto registries.default after every spread.
  const jsonAuth = readJsonAuthTier(pnpmVersion);
  const globalSettings = readPnpmGlobalSettings(pnpmVersion);
  const globalPath = getGlobalConfigPath();
  const scopedRegistry = scope
    ? (jsonAuth?.registries[scope] ??
      pickYamlRegistry(settings, scope, workspaceFile) ??
      pickYamlRegistry(globalSettings, scope, globalPath))
    : undefined;
  if (scope && scopedRegistry) {
    setScopedRegistry(env, scope, scopedRegistry);
  }
  // A top-level `registry` in a yaml file is an explicitly set key, which pnpm
  // applies onto registries.default on its own. Where it does that moved: from
  // 11.5.3 before the workspace file is even read, so only the global file's
  // reaches it and every map still outranks it, and from 11.10.0 again after
  // every map has merged, which puts both files' above the JSON auth tier.
  const lateScalar = gte(pnpmVersion, '11.10.0')
    ? settings.registry || globalSettings.registry
    : undefined;
  const earlyScalar =
    gte(pnpmVersion, '11.5.3') && lt(pnpmVersion, '11.10.0')
      ? globalSettings.registry
      : undefined;
  const defaultRegistry =
    readPnpmEnvVar('registry', pnpmVersion) ??
    lateScalar ??
    jsonAuth?.registries['default'] ??
    pickYamlRegistry(settings, 'default', workspaceFile) ??
    earlyScalar ??
    pickYamlRegistry(globalSettings, 'default', globalPath);
  if (defaultRegistry) {
    setRegistry(env, defaultRegistry);
  }

  const authIniPath = getAuthIniPath();
  applyUrlScopedEnvConfig(env, pnpmVersion);
  applyJsonAuthCredentials(env, scope, jsonAuth);
  // From 11 pnpm reads one project .npmrc, and it is the one beside the
  // workspace file it walked up to, not the one in the directory it runs in
  // (loadNpmrcConfig's `workspaceDir ?? localPrefix`). npm reads the latter for
  // itself, so a nested workspace puts the two readers on different files.
  const workspaceDir = workspaceFile ? dirname(workspaceFile) : root;
  const npmrcProxies = bridgeNpmrcSources(
    env,
    root,
    workspaceDir,
    scope,
    authIniPath,
    pnpmVersion,
    managerIgnoresEnv
  );
  reportTokenHelper(
    env,
    root,
    scope,
    getPnpmUserConfigPath(pnpmVersion, root),
    pnpmVersion,
    managerIgnoresEnv
  );

  // resolveNoProxy takes the bypass list across every layer below, so the yaml
  // does not write it here.
  applyYamlNetworkSettings(env, globalSettings, false);
  applyYamlNetworkSettings(env, settings, false);
  applyEnvNetworkSettings(env, pnpmVersion);
  applyResolvedProxies(
    env,
    [envProxyDeclarations(pnpmVersion), settings, globalSettings, npmrcProxies],
    root,
    scope,
    managerIgnoresEnv
  );
  const noProxy = resolveNoProxy(
    settings,
    globalSettings,
    workspaceDir,
    authIniPath,
    pnpmVersion
  );
  if (noProxy) {
    setProxies(env, { noProxy });
  }
  return env;
}

/**
 * pnpm's own env reader: the lowercase prefix, then the uppercase one (which
 * only arrived in 11.0.6), with an empty value counting as undeclared.
 * See readEnvVar in pnpm's config reader.
 */
function readPnpmEnvVar(key: string, pnpmVersion: string): string | undefined {
  const value =
    process.env[`pnpm_config_${key}`] ??
    (gte(pnpmVersion, '11.0.6')
      ? process.env[`PNPM_CONFIG_${key.toUpperCase()}`]
      : undefined);
  return value || undefined;
}

/**
 * The URL-scoped entries pnpm >= 11.6.0 reads from the environment
 * (readUrlScopedEnvConfig): `p?npm_config_//<dart>:<key>`, case-insensitive
 * prefix, minus `:tokenHelper`, which pnpm refuses to take from it. The
 * `npm_config_` spellings reach the spawned npm ambiently (mergeNpmConfigEnv
 * keeps them for these versions); the `pnpm_config_` spellings are invisible to
 * npm, so re-spell those onto the overlay, which also reproduces pnpm merging
 * its own prefix above npm's for the same dart.
 */
function applyUrlScopedEnvConfig(env: NpmConfigEnv, pnpmVersion: string): void {
  if (lt(pnpmVersion, '11.6.0')) {
    return;
  }
  for (const [key, value] of Object.entries(process.env)) {
    // pnpm skips a null or empty value outright, matching npm's env tier.
    if (!value) {
      continue;
    }
    const match = /^pnpm_config_(\/\/.+)$/i.exec(key);
    if (!match || match[1].endsWith(':tokenHelper')) {
      continue;
    }
    env[`npm_config_${match[1]}`] = value;
  }
}

type JsonAuthTier = {
  /** One credential per (registry, scope), scope `@` meaning registry-wide. */
  auth: { dart: string; scope: string; token: string }[];
  /** `default` plus `@scope` keys, WHATWG-normalized URLs. */
  registries: Record<string, string>;
};

/**
 * The JSON auth tier pnpm reads from 11.10.0: `pnpm_config__auth` (then the
 * uppercase spelling, an empty value skipped) parsed as JSON, over the global
 * config.yaml's top-level `_auth`, merged per entry with the env winning.
 * Its registries outrank the workspace yaml and lose to the named env/CLI
 * registry; its credentials outrank the URL-scoped env tier and every file.
 * pnpm dies on a declaration it cannot parse, so that throws into the caller's
 * fall-open. See readJsonAuthEnv/parseJsonAuth in pnpm's config reader.
 */
function readJsonAuthTier(pnpmVersion: string): JsonAuthTier | null {
  if (lt(pnpmVersion, '11.10.0')) {
    return null;
  }
  const raw =
    process.env['pnpm_config__auth'] ||
    process.env['PNPM_CONFIG__AUTH'] ||
    undefined;
  let envTier: JsonAuthTier | null = null;
  if (raw !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        'The pnpm_config__auth environment variable is not valid JSON.'
      );
    }
    envTier = parsePnpmJsonAuth(parsed, 'pnpm_config__auth');
  }
  const yamlAuth = readPnpmGlobalConfigYaml()?.['_auth'];
  const yamlTier =
    yamlAuth != null ? parsePnpmJsonAuth(yamlAuth, '_auth') : null;
  if (!envTier && !yamlTier) {
    return null;
  }
  const merged = new Map<string, JsonAuthTier['auth'][number]>();
  for (const tier of [yamlTier, envTier]) {
    for (const entry of tier?.auth ?? []) {
      merged.set(`${entry.scope}\0${entry.dart}`, entry);
    }
  }
  return {
    auth: [...merged.values()],
    registries: {
      ...(yamlTier?.registries ?? {}),
      ...(envTier?.registries ?? {}),
    },
  };
}

/**
 * pnpm's parseJsonAuth: registry URL over scope, each leaf exactly
 * { authToken: string }, every violation fatal. Messages carry the setting
 * name and entry position rather than the entry itself, since a malformed
 * URL key can embed credentials.
 */
function parsePnpmJsonAuth(parsed: unknown, source: string): JsonAuthTier {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `The pnpm ${source} setting must be a JSON object of registry URLs.`
    );
  }
  const auth: JsonAuthTier['auth'] = [];
  const registries: Record<string, string> = {};
  let entryNumber = 0;
  for (const [rawUrl, scopes] of Object.entries(parsed)) {
    entryNumber++;
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw invalidJsonAuthEntry(source, entryNumber);
    }
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.hostname === '' ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw invalidJsonAuthEntry(source, entryNumber);
    }
    // pnpm nerf-darts the href as-is: a path without a trailing slash scopes
    // to its parent directory, and normalize-registry-url never alters an href.
    const dart = nerfDart(url.href);
    if (!dart) {
      throw invalidJsonAuthEntry(source, entryNumber);
    }
    if (
      scopes === null ||
      typeof scopes !== 'object' ||
      Array.isArray(scopes)
    ) {
      throw invalidJsonAuthScopes(source, entryNumber);
    }
    for (const [scope, creds] of Object.entries(scopes)) {
      const validScope =
        scope === '@' ||
        (scope.startsWith('@') &&
          scope.length > 1 &&
          !scope.includes('/') &&
          !scope.includes(':'));
      if (
        !validScope ||
        creds === null ||
        typeof creds !== 'object' ||
        Array.isArray(creds) ||
        Object.keys(creds).some((field) => field !== 'authToken') ||
        typeof (creds as Record<string, unknown>)['authToken'] !== 'string'
      ) {
        throw invalidJsonAuthScopes(source, entryNumber);
      }
      auth.push({
        dart,
        scope,
        token: (creds as Record<string, string>)['authToken'],
      });
      registries[scope === '@' ? 'default' : scope] = url.href;
    }
  }
  return { auth, registries };
}

function invalidJsonAuthEntry(source: string, entryNumber: number): Error {
  return new Error(
    `Entry ${entryNumber} of the pnpm ${source} setting is not a plain http(s) registry URL.`
  );
}

function invalidJsonAuthScopes(source: string, entryNumber: number): Error {
  return new Error(
    `Entry ${entryNumber} of the pnpm ${source} setting must map scopes ("@" or "@org") to { "authToken": string } objects.`
  );
}

/**
 * npm has no scope-qualified auth key, so a scoped entry lands on the plain
 * dart, and only for the scope of the package being fetched: pnpm would not
 * send that token for anything else. Registry-wide entries go first so a
 * scoped token for the same registry wins, the way pnpm's per-scope credential
 * lookup prefers the specific entry. Every registry in the map is bridged, on
 * the same grounds as the auth.ini dart loop.
 */
function applyJsonAuthCredentials(
  env: NpmConfigEnv,
  scope: string | null,
  jsonAuth: JsonAuthTier | null
): void {
  if (!jsonAuth) {
    return;
  }
  for (const wanted of scope ? ['@', scope] : ['@']) {
    for (const entry of jsonAuth.auth) {
      if (entry.scope === wanted) {
        env[`npm_config_${entry.dart}:_authToken`] = entry.token;
      }
    }
  }
}

/**
 * The TLS settings pnpm >= 11 takes from its own `PNPM_CONFIG_*` prefix. They
 * outrank pnpm-workspace.yaml, so they are applied after it. `cafile` is left
 * out on purpose: pnpm accepts it and then never uses it for the fetch, the
 * same dead config as the yaml key.
 */
function applyEnvNetworkSettings(env: NpmConfigEnv, pnpmVersion: string): void {
  const strictSsl = readPnpmEnvVar('strict_ssl', pnpmVersion);
  if (strictSsl !== undefined) {
    // parseField types this Boolean, so only an explicit 'false' turns
    // verification off.
    setStrictSsl(env, strictSsl !== 'false');
  }
}

/** The proxy settings pnpm >= 11 takes from its own `PNPM_CONFIG_*` prefix. */
function envProxyDeclarations(pnpmVersion: string): ProxyDeclarations {
  return {
    proxy: readPnpmEnvVar('proxy', pnpmVersion),
    httpProxy: readPnpmEnvVar('http_proxy', pnpmVersion),
    httpsProxy: readPnpmEnvVar('https_proxy', pnpmVersion),
  };
}

/** The proxy settings one configuration tier declares, in pnpm's spellings. */
interface ProxyDeclarations {
  proxy?: string;
  httpProxy?: string;
  httpsProxy?: string;
}

/**
 * The two proxies npm should end up with for `registry`. pnpm resolves each of
 * the three settings across every tier first, and only then falls back from
 * httpsProxy to the legacy proxy and from httpProxy to whichever of those won,
 * so the derivation cannot be done per tier: a workspace file's httpsProxy is
 * what an environment-supplied `proxy` leaves undeclared, and so still wins.
 *
 * npm has no http-only proxy, its `proxy` serving https too when `https-proxy`
 * is unset, so an http-only one is withheld unless http is what npm requests.
 * A value npm already resolves for itself under the same key is left to it.
 */
function resolveProxies(
  tiers: ProxyDeclarations[],
  registry: string,
  npmSees: (key: string) => string | undefined
): { httpProxy?: string; httpsProxy?: string } {
  const declared = (key: keyof ProxyDeclarations): string | undefined =>
    tiers.map((tier) => tier[key]).find(Boolean);
  const httpsProxy = declared('httpsProxy') || declared('proxy');
  const httpProxy = declared('httpProxy') || httpsProxy;
  const send = (value: string | undefined, npmKey: string) =>
    value === npmSees(npmKey) ? undefined : value;
  return {
    httpProxy: send(
      httpsProxy || registry.startsWith('http://') ? httpProxy : undefined,
      'proxy'
    ),
    httpsProxy: send(httpsProxy, 'https-proxy'),
  };
}

/**
 * The proxy-bypass list pnpm >= 11 ends up using. It reads the `no-proxy`
 * spelling and only falls back to `noproxy`, so the spelling decides before the
 * layer does: a workspace .npmrc `no-proxy` beats a pnpm-workspace.yaml
 * `noproxy`. Within one spelling the env sits above the yaml files, the
 * workspace one above the global one, and those above the npmrc-family files.
 * See createPackageManagerNetworkConfig in pnpm's config reader.
 */
function resolveNoProxy(
  settings: PnpmWorkspaceSettings,
  globalSettings: PnpmWorkspaceSettings,
  npmrcDir: string,
  authIniPath: string,
  pnpmVersion: string
): string | undefined {
  const envNoProxy = readPnpmEnvVar('no_proxy', pnpmVersion);
  if (envNoProxy) {
    return envNoProxy;
  }
  const yamlNoProxy = settings.noProxy ?? globalSettings.noProxy;
  if (yamlNoProxy) {
    return yamlNoProxy;
  }
  const fromFiles = fileNoProxy(
    [join(npmrcDir, '.npmrc'), authIniPath],
    pnpmVersion
  );
  if (fromFiles) {
    return fromFiles;
  }
  return (
    readPnpmEnvVar('noproxy', pnpmVersion) ??
    settings.noproxy ??
    globalSettings.noproxy
  );
}

/**
 * pnpm looks pnpm-workspace.yaml up before a reader that only tolerates ENOENT,
 * so whatever this misses reads as absent while a file it finds and cannot open
 * aborts the command. 11.8.0 swapped find-up, which requires the match to be a
 * file, for a bare existence check, which is where a directory in the file's
 * place stops being looked past.
 */
function pnpmFindsWorkspaceFile(path: string, pnpmVersion: string): boolean {
  return lt(pnpmVersion, '11.8.0') ? fileExists(path) : existsSync(path);
}

const WORKSPACE_MANIFEST_FILENAME = 'pnpm-workspace.yaml';
/**
 * pnpm's INVALID_WORKSPACE_MANIFEST_FILENAME: names near enough the real one
 * that it looks for them alongside it and refuses to walk past one it finds.
 */
const MISSPELLED_WORKSPACE_MANIFEST_NAMES = [
  'pnpm-workspaces.yaml',
  'pnpm-workspaces.yml',
  'pnpm-workspace.yml',
];
/** 11.0.0 added the dot-prefixed spellings to that list. */
const MISSPELLED_WORKSPACE_MANIFEST_NAMES_11 = [
  ...MISSPELLED_WORKSPACE_MANIFEST_NAMES,
  '.pnpm-workspace.yaml',
  '.pnpm-workspace.yml',
  '.pnpm-workspaces.yaml',
  '.pnpm-workspaces.yml',
];

/**
 * pnpm resolves pnpm-workspace.yaml by walking up from the directory it runs
 * in and stopping at the nearest hit, so a workspace nested under another one
 * inherits the outer file's settings. Null when no directory on the way up has
 * one.
 * See findWorkspaceDir in pnpm's workspace root finder.
 */
function findPnpmWorkspaceFile(
  root: string,
  pnpmVersion: string
): string | null {
  // The env var names the directory outright, skipping the walk without
  // checking that the file is there, so a missing one reads as a workspace
  // declaring nothing rather than sending the lookup back up the tree.
  const fromEnv = readEnvVar(process.env, 'NPM_CONFIG_WORKSPACE_DIR');
  if (fromEnv) {
    return join(resolve(root, fromEnv), WORKSPACE_MANIFEST_FILENAME);
  }
  const misspelled = lt(pnpmVersion, '11.0.0')
    ? MISSPELLED_WORKSPACE_MANIFEST_NAMES
    : MISSPELLED_WORKSPACE_MANIFEST_NAMES_11;
  for (const dir of [root, ...ancestorDirectories(root)]) {
    const path = join(dir, WORKSPACE_MANIFEST_FILENAME);
    // Looked up first, because pnpm searches the names in this order within a
    // directory and takes the first hit: a correctly named file beside a
    // misspelled one is the one it reads.
    if (pnpmFindsWorkspaceFile(path, pnpmVersion)) {
      return path;
    }
    for (const name of misspelled) {
      const misspelledPath = join(dir, name);
      if (pnpmFindsWorkspaceFile(misspelledPath, pnpmVersion)) {
        // pnpm aborts the command here (BAD_WORKSPACE_MANIFEST_NAME) instead of
        // walking on, so there is no resolution left to reproduce. Propagating
        // to the caller's fall-open warns instead of silently resolving against
        // a correctly named file further up that pnpm never reaches.
        throw new Error(
          `The pnpm workspace manifest file should be named "${WORKSPACE_MANIFEST_FILENAME}". File found: ${misspelledPath}`
        );
      }
    }
  }
  return null;
}

function readPnpmWorkspaceSettings(
  path: string | null,
  pnpmVersion: string
): PnpmWorkspaceSettings {
  if (path === null) {
    return {};
  }
  const doc = readPnpmYamlConfig(path);
  if (doc === null) {
    return {};
  }
  if (doc === 'unusable') {
    // pnpm aborts on this file, so there is no resolution left to reproduce.
    // Propagating to the caller's fall-open warns instead of silently treating
    // the workspace as declaring no registry.
    throw new Error(`The pnpm workspace file at ${path} could not be read.`);
  }
  return normalizePnpmWorkspaceSettings(
    resolveYamlEnv(doc, path, pnpmVersion, false),
    path
  );
}

/**
 * The scalar settings pnpm withholds from an untrusted file rather than
 * expanding a `${VAR}` into them, its REQUEST_DESTINATION_SCALAR_KEYS.
 */
const PNPM_REQUEST_DESTINATION_SCALARS = new Set([
  'pnprServer',
  'registry',
  'httpProxy',
  'httpsProxy',
  'noProxy',
  'proxy',
  'noproxy',
]);

/**
 * A yaml settings file as pnpm's replaceEnvInSettings leaves it. Which
 * `${VAR}` it touches moved twice, and what it does with one it cannot resolve
 * moved once:
 *
 * - Keys, on every line from 10.7.0, and a key it resolves nothing for aborts
 *   the command. 10.6.0 has no replacer at all and takes the file verbatim.
 * - Top-level string values, on the same line, and likewise fatal.
 * - `registries` and `namedRegistries` values, from 11.1.0.
 * - From 11.5.3 a value naming a request destination is dropped instead, when
 *   the file is one a project controls. The global config.yaml is trusted and
 *   keeps expanding.
 *
 * A nested object elsewhere is passed through untouched on every line, so a
 * placeholder there is neither expanded nor fatal.
 *
 * Values come back in the form npm's own expansion turns back into what pnpm
 * resolved: a line that expands leaves an escaped reference for npm to consume
 * (expandPnpmEnvVars), and a line that does not escapes what it passes through.
 */
function resolveYamlEnv(
  doc: Record<string, unknown>,
  path: string,
  pnpmVersion: string,
  trusted: boolean
): Record<string, unknown> {
  const expand = (value: string): string => {
    if (!pnpmEnvVarsResolve(value)) {
      // pnpm aborts the command here, so there is no resolution left to
      // reproduce. Propagating to the caller's fall-open warns instead.
      throw new Error(
        `The pnpm configuration file at ${path} references an environment variable that is not set: ${value}`
      );
    }
    return expandPnpmEnvVars(value);
  };
  const expands = gte(pnpmVersion, '10.7.0');
  const resolveScalar = expands ? expand : escapeNpmEnvExpr;
  const resolveRegistry = gte(pnpmVersion, '11.1.0')
    ? resolveScalar
    : escapeNpmEnvExpr;
  const drops = !trusted && gte(pnpmVersion, '11.5.3');
  const resolved: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(doc)) {
    const key = expands ? expand(rawKey) : rawKey;
    if (typeof value === 'string') {
      if (
        drops &&
        PNPM_REQUEST_DESTINATION_SCALARS.has(key) &&
        PNPM_ENV_PLACEHOLDER.test(value)
      ) {
        continue;
      }
      resolved[key] = resolveScalar(value);
    } else if (key === 'registries' || key === 'namedRegistries') {
      resolved[key] = mapYamlStrings(value, (entry) =>
        drops && PNPM_ENV_PLACEHOLDER.test(entry)
          ? undefined
          : resolveRegistry(entry)
      );
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * `map` over the string values of a plain object, an entry it returns nothing
 * for dropped. Anything else is passed through, which is how pnpm's own two
 * mappers treat a shape they were not given.
 */
function mapYamlStrings(
  value: unknown,
  map: (value: string) => string | undefined
): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const mapped: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      mapped[key] = entry;
      continue;
    }
    const result = map(entry);
    if (result !== undefined) {
      mapped[key] = result;
    }
  }
  return mapped;
}

/**
 * pnpm type-checks none of these, so its tolerance is uneven and each shape
 * here mirrors a measured 11.10.0 outcome. A truthy non-string proxy breaks
 * pnpm's own fetch, so it is fatal into the caller's fall-open; a falsy one is
 * never read as a proxy at all and drops here the way it drops there. A
 * wrong-shaped noProxy also survives pnpm, so it is dropped
 * rather than handed to the string-typed spawn env. `registries` and
 * `strictSsl` stay unnarrowed for the consumer that reads them, because pnpm
 * only reacts to the registry value it picks, and turns TLS verification off
 * for the boolean alone.
 */
function normalizePnpmWorkspaceSettings(
  doc: Record<string, unknown>,
  path: string
): PnpmWorkspaceSettings {
  const fail = (what: string): never => {
    throw new Error(`The pnpm configuration file at ${path} declares ${what}.`);
  };
  if (doc.proxy && typeof doc.proxy !== 'string') {
    fail('a proxy that is not a string');
  }
  if (doc.httpProxy && typeof doc.httpProxy !== 'string') {
    fail('an httpProxy that is not a string');
  }
  if (doc.httpsProxy && typeof doc.httpsProxy !== 'string') {
    fail('an httpsProxy that is not a string');
  }
  const text = (key: string): string | undefined =>
    typeof doc[key] === 'string' ? (doc[key] as string) : undefined;
  return {
    registries: doc.registries,
    strictSsl: doc.strictSsl,
    registry: text('registry'),
    proxy: text('proxy'),
    httpProxy: text('httpProxy'),
    httpsProxy: text('httpsProxy'),
    noProxy: text('noProxy'),
    noproxy: text('noproxy'),
    ca: text('ca'),
    cert: text('cert'),
    key: text('key'),
  };
}

/**
 * The yaml registry for `key`, fatal when it exists with a non-string shape:
 * pnpm dies in `new URL` on the registry it picks (measured on 11.10.0), and an
 * entry it never picks harms nothing, so the check runs per pick rather than
 * over the whole map. A registries that is not a map declares no entry at all,
 * which is how pnpm resolves one.
 */
function pickYamlRegistry(
  settings: PnpmWorkspaceSettings,
  key: string,
  path: string | null
): string | undefined {
  const { registries } = settings;
  if (
    registries === null ||
    typeof registries !== 'object' ||
    Array.isArray(registries)
  ) {
    return undefined;
  }
  const value = (registries as Record<string, unknown>)[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(
      `The pnpm configuration file at ${path} declares a registries["${key}"] that is not a string.`
    );
  }
  return value;
}

function getAuthIniPath(): string {
  return join(getPnpmConfigDir(process.env), 'auth.ini');
}

function getGlobalConfigPath(): string {
  return join(getPnpmConfigDir(process.env), 'config.yaml');
}

/**
 * The global config.yaml, null when absent. pnpm reads this one straight,
 * without the existence check it puts in front of pnpm-workspace.yaml, so every
 * command aborts on a file it cannot open or parse. That propagates to the
 * caller's fall-open instead of resolving on without the file's settings.
 */
function readPnpmGlobalConfigYaml(): Record<string, unknown> | null {
  const path = getGlobalConfigPath();
  const doc = readPnpmYamlConfig(path);
  if (doc === 'unusable') {
    throw new Error(
      `The pnpm global configuration file at ${path} could not be read.`
    );
  }
  return doc;
}

/**
 * The settings pnpm >= 11 takes from that file. It applies them the way it
 * applies a workspace manifest, over the npmrc-derived config and under the
 * workspace file's own, but only for the keys it allows there: `registries` is
 * refused with a warning until 11.11.0, while every other key read here is an
 * npm setting name it has always allowed. The file is the user's own rather
 * than a project's, so a `${VAR}` naming a request destination is expanded
 * instead of withheld.
 */
function readPnpmGlobalSettings(pnpmVersion: string): PnpmWorkspaceSettings {
  if (lt(pnpmVersion, '11.0.0')) {
    return {};
  }
  const doc = readPnpmGlobalConfigYaml();
  if (doc === null) {
    return {};
  }
  const path = getGlobalConfigPath();
  const settings = normalizePnpmWorkspaceSettings(
    resolveYamlEnv(doc, path, pnpmVersion, true),
    path
  );
  if (lt(pnpmVersion, '11.11.0')) {
    delete settings.registries;
  }
  return settings;
}

// pnpm keeps resolving from the remaining layers for an npmrc-family file it
// cannot read, so mirror the absent semantics. It stays silent on ENOENT and
// EISDIR and warns otherwise; we warn for the whole unreadable class, minus the
// ENOTDIR the reader already reports as absent, where pnpm warns and resolves
// on all the same.
const warnedUnreadableFiles = new Set<string>();
function warnUnreadableFile(path: string): void {
  if (warnedUnreadableFiles.has(path)) {
    return;
  }
  warnedUnreadableFiles.add(path);
  logger.warn(
    `Could not read ${path}; resolving the pnpm registry configuration without it, the way pnpm itself does.`
  );
}

function readNpmrcEntriesOrWarn(path: string): NpmrcEntry[] | null {
  const entries = readNpmrcEntries(path);
  if (entries !== 'unreadable') {
    return entries;
  }
  warnUnreadableFile(path);
  return null;
}

/** An npmrc-family file as written, null when it could not be read. */
function readNpmrcOrWarn(path: string): Map<string, string> | null {
  const entries = readNpmrcEntriesOrWarn(path);
  return entries && npmrcEntriesToMap(entries);
}

/**
 * The same file as pnpm ends up with it, which below 11 can be not at all: its
 * reader expands `${VAR}` in both halves of an entry through a function that
 * throws on a reference it resolves nothing for, and the config chain catches
 * that per file, so one bad reference costs every entry in the file and pnpm
 * carries on from the layers below. From 11 the lossy reader substitutes an
 * empty string per entry instead and the file survives.
 * See parseKey/parseField and Conf.addFile in pnpm's bundled npm-conf.
 */
function readPnpmNpmrcMap(
  path: string,
  pnpmVersion: string
): Map<string, string> | null {
  const entries = readNpmrcEntriesOrWarn(path);
  if (entries === null || gte(pnpmVersion, '11.0.0')) {
    return entries && npmrcEntriesToMap(entries);
  }
  // parseField hands a `key[]` array straight back, so the values under a key
  // ini collected into one are never expanded and never throw. The key is, and
  // one repeated line is enough to make every value under it an array.
  const arrayKeys = new Set(
    entries.filter((entry) => entry.array).map((entry) => entry.key)
  );
  for (const { key, value } of entries) {
    if (
      !pnpmEnvVarsResolve(key) ||
      (!arrayKeys.has(key) && !pnpmEnvVarsResolve(value))
    ) {
      return null;
    }
  }
  return npmrcEntriesToMap(entries);
}

// pnpm's AUTH_VALUE_KEYS. BARE_AUTH_KEYS is the subset this file re-keys onto a
// nerf dart; the three extras are only ever read as part of the test below.
const PNPM_AUTH_VALUE_KEYS = [
  ...BARE_AUTH_KEYS,
  'tokenHelper',
  'cert',
  'key',
] as const;
// pnpm's hasEnvPlaceholder, which unlike its expander honors no escape.
const PNPM_ENV_PLACEHOLDER = /\$\{[^}]+\}/;

const isRegistryKey = (key: string): boolean =>
  key === 'registry' || (key.startsWith('@') && key.endsWith(':registry'));

const isAuthValueKey = (key: string): boolean =>
  PNPM_AUTH_VALUE_KEYS.some((k) => key === k || key.endsWith(`:${k}`));

/** pnpm's isRequestDestinationKey: the set its key-side test covers. */
const isRequestDestinationKey = (key: string): boolean =>
  isRegistryKey(key) || key.startsWith('//');

/** pnpm's isRequestDestinationValueKey: the set its value-side test covers. */
const isRequestDestinationValueKey = (key: string): boolean =>
  isRegistryKey(key) ||
  key === 'proxy' ||
  key === 'http-proxy' ||
  key === 'https-proxy';

/** Whether 11.5.3+ drops an entry rather than expanding its `${VAR}`. */
function pnpmDropsProjectEntry(
  rawKey: string,
  key: string,
  rawValue: string
): boolean {
  if (
    PNPM_ENV_PLACEHOLDER.test(rawKey) &&
    // Tested on both sides of the expansion, because a placeholder can carry a
    // key that is plain in neither set into one of them and vice versa.
    (isRequestDestinationKey(rawKey) ||
      isAuthValueKey(rawKey) ||
      isRequestDestinationKey(key) ||
      isAuthValueKey(key))
  ) {
    return true;
  }
  return (
    PNPM_ENV_PLACEHOLDER.test(rawValue) &&
    (isRequestDestinationValueKey(key) || isAuthValueKey(key))
  );
}

/** An npmrc-family file in pnpm's merge. */
interface PnpmNpmrcSource {
  /** The directory a relative cafile in this file resolves against. */
  dir: string;
  map: Map<string, string>;
  /** strict-ssl as written, which is what types it. */
  rawStrictSsl: string | undefined;
  /** True when npm opens this file itself, so its entries need no bridging. */
  npmNative: boolean;
  /** The bare credential keys this file carried, already re-keyed onto `dart`. */
  rescoped: string[];
  /** The nerf dart this file pins its own unscoped credentials to. */
  dart: string | null;
}

/**
 * One npmrc-family file as pnpm reads it: both halves expanded, rebuilt in file
 * order so a later key that resolves to the same setting wins, the way pnpm's
 * own assignment does. npm's env-tier expansion uses a different grammar, which
 * is why the values are expanded here rather than left to the spawn.
 *
 * `filtered` applies the rule pnpm puts on the workspace file alone: until
 * 11.5.3 a `${VAR}` expanded there like anywhere else, so a placeholder-keyed
 * entry lands under the spelling it expands to; from 11.5.3 an entry naming a
 * host or carrying a credential is dropped instead of expanded when either half
 * holds one. See readAndFilterNpmrc in pnpm's config reader.
 */
function readPnpmNpmrcEntries(
  raw: Map<string, string>,
  pnpmVersion: string,
  filtered: boolean
): Pick<PnpmNpmrcSource, 'map' | 'rawStrictSsl' | 'rescoped' | 'dart'> {
  const drops = filtered && gte(pnpmVersion, '11.5.3');
  const map = new Map<string, string>();
  for (const [rawKey, rawValue] of raw) {
    const key = PNPM_ENV_PLACEHOLDER.test(rawKey)
      ? expandPnpmEnvVars(rawKey)
      : rawKey;
    if (drops && pnpmDropsProjectEntry(rawKey, key, rawValue)) {
      continue;
    }
    map.set(key, rawValue);
  }
  // parseField decides a Boolean-typed setting from the literal value, before it
  // expands any `${VAR}`, so strict-ssl has to be read pre-expansion.
  const rawStrictSsl = map.get('strict-ssl');
  for (const [key, value] of map) {
    map.set(key, expandPnpmEnvVars(value));
  }
  // pnpm's getDefaultCreds applies a bare global _authToken/_auth/username/
  // _password (no nerf-dart prefix); npm honors auth only in the nerf-darted
  // form, so re-key each onto the registry this file itself carries, or npmjs
  // when it carries none. pnpm does this per file and before the merge
  // (rescopeUnscopedCreds), which is why two files can each contribute a bare
  // credential under a different dart, and why a dart the same file spells out
  // keeps its own value. From 11.4.0 that is pnpm's own pin; earlier 11.x paired
  // the credential with whichever registry won overall, which let a
  // workspace-local .npmrc or pnpm-workspace.yaml aim a user-level credential at
  // a host of its choosing (CVE-2026-50017), so the pin is applied there too
  // rather than reproducing the hole.
  const dart = nerfDart(map.get('registry') || DEFAULT_REGISTRY);
  const rescoped: string[] = [];
  for (const bareKey of PNPM_RESCOPABLE_KEYS) {
    const value = map.get(bareKey);
    if (value === undefined) {
      continue;
    }
    map.delete(bareKey);
    // An unparseable registry leaves pnpm nowhere safe to pin them, so it drops
    // them outright.
    if (!dart) {
      continue;
    }
    // Re-keyed on presence, an empty value included, because that is how pnpm
    // does it: an emptied credential goes on to shadow the same key in every
    // file below, which is how a workspace clears one it inherits.
    if (!map.has(`${dart}:${bareKey}`)) {
      map.set(`${dart}:${bareKey}`, value);
    }
    // Nothing is withheld from npm when the credential was empty to begin with.
    if (value && (BARE_AUTH_KEYS as readonly string[]).includes(bareKey)) {
      rescoped.push(bareKey);
    }
  }
  return { map, rawStrictSsl, rescoped, dart };
}

/**
 * The .npmrc files pnpm reads below its own environment, highest first: the one
 * beside the package.json the command runs from, then the one beside the
 * workspace manifest it walked up to. They are the same file for a workspace
 * that is its own root, and the second is the tier npm has none of.
 */
function pnpmNpmrcPaths(root: string, workspaceFile: string | null): string[] {
  const project = join(root, '.npmrc');
  const workspaceDir = workspaceFile ? dirname(workspaceFile) : root;
  return workspaceDir === root
    ? [project]
    : [project, join(workspaceDir, '.npmrc')];
}

/**
 * An npmrc-family file with its keys expanded, rebuilt in file order so a later
 * key that expands onto the same setting wins the way pnpm's own assignment
 * does. Values stay as written, because parseField types a Boolean setting from
 * the literal before any `${VAR}` in it is expanded.
 */
function expandPnpmNpmrcKeys(raw: Map<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [rawKey, rawValue] of raw) {
    map.set(expandPnpmEnvVars(rawKey), rawValue);
  }
  return map;
}

/**
 * The workspace .npmrc pnpm below 11 layers under the project one. npm has no
 * tier for it at all, so a setting the project file leaves undeclared has to
 * reach npm through the environment; one the project file declares npm resolves
 * for itself, and injecting the workspace value would put it above that file
 * rather than below it. The ambient npm_config_* both readers honor on this line
 * outranks either file, so a setting declared there is left alone as well.
 *
 * A bare credential is deliberately not bridged. pnpm has no per-file rescoping
 * here and pins one to nerfDart(allSettings.registry), the registry the npmrc
 * chain resolves rather than the one the pnpm-workspace.yaml sends the fetch to,
 * so npm's nerf-darted form cannot be derived from what this can see.
 */
function bridgeWorkspaceNpmrc(
  env: NpmConfigEnv,
  npmrcPaths: string[],
  scope: string | null,
  pnpmVersion: string
): ProxyDeclarations {
  const [projectPath, workspacePath] = npmrcPaths;
  // pnpm's view of the shadowing tier: a file its reader discarded shadows
  // nothing, even though npm goes on reading that same file for itself.
  const projectRaw = readPnpmNpmrcMap(projectPath, pnpmVersion);
  const projectNpmrc = projectRaw ? expandPnpmNpmrcKeys(projectRaw) : null;
  const workspaceRaw = workspacePath
    ? readPnpmNpmrcMap(workspacePath, pnpmVersion)
    : null;
  const workspaceNpmrc = workspaceRaw
    ? expandPnpmNpmrcKeys(workspaceRaw)
    : null;
  /** What pnpm resolves from these files and the env tier over them. */
  const resolved = (key: string): string | undefined =>
    expandPnpmEnvVars(
      readNpmConfigEnv(process.env, key) ??
        (projectNpmrc?.has(key)
          ? projectNpmrc.get(key)
          : workspaceNpmrc?.get(key)) ??
        ''
    ) || undefined;
  const proxies: ProxyDeclarations = {
    proxy: resolved('proxy'),
    httpProxy: resolved('http-proxy'),
    httpsProxy: resolved('https-proxy'),
  };
  if (!workspaceNpmrc) {
    return proxies;
  }

  /** The value as written, unless a tier above the workspace file declares one. */
  const declared = (key: string): string | undefined =>
    projectNpmrc?.has(key) || readNpmConfigEnv(process.env, key) !== undefined
      ? undefined
      : workspaceNpmrc.get(key);
  // An empty value declares nothing to derive from: pnpm's own readers re-check
  // for an empty registry, and npm skips an empty env value outright. Deriving
  // from one is what does damage (an empty cafile resolves to its own directory).
  const bridged = (key: string): string | undefined =>
    expandPnpmEnvVars(declared(key) ?? '') || undefined;

  // A registry the yaml already forced in outranks these files in pnpm, so it
  // keeps winning here.
  const registry = bridged('registry');
  if (!env['npm_config_registry'] && registry) {
    setRegistry(env, registry);
  }
  const scopedRegistry = scope ? bridged(`${scope}:registry`) : undefined;
  if (scope && !env[`npm_config_${scope}:registry`] && scopedRegistry) {
    setScopedRegistry(env, scope, scopedRegistry);
  }
  // Every dart is copied, not just the contacted registry's: npm resolves auth
  // per fetched URI and sends only the matching key, so a tarball served from a
  // second authenticated host keeps working. Filtering here would strip it.
  for (const key of workspaceNpmrc.keys()) {
    // npm has no tokenHelper setting, and pnpm takes one from its user config
    // alone, so a scoped helper here stands for no credential the fetch had.
    // `:cert`/`:key` carry inline PEM, which neither tool reads in scoped form
    // (pnpm's getNetworkConfigs pairs a registry with `:certfile`/`:keyfile`
    // paths, the same keys npm resolves per URI, and those do go through).
    if (
      !key.startsWith('//') ||
      key.endsWith(':tokenHelper') ||
      key.endsWith(':cert') ||
      key.endsWith(':key')
    ) {
      continue;
    }
    const value = bridged(key);
    if (value) {
      env[`npm_config_${key}`] = value;
    }
  }

  const cafile = bridged('cafile');
  if (cafile) {
    // pnpm's only reader on this line is loadCAFile, a bare readFileSync on the
    // raw value, so a relative one resolves against the cwd the command runs in,
    // which is the root the spawn uses. It expands no leading `~`, and npm
    // ignores a cafile it cannot open, so getting the base wrong drops the trust
    // anchor with no diagnostic at all. (11.2.0 moved that base to the directory
    // of the declaring file.)
    setCafile(env, resolve(dirname(projectPath), cafile));
  }
  // Flat keys on this line: pnpm pins neither trust anchors nor client TLS
  // material to a registry before 11, and npm reads all three the same way.
  for (const key of ['ca', 'cert', 'key'] as const) {
    const value = bridged(key);
    if (value) {
      env[`npm_config_${key}`] = value;
    }
  }
  const rawStrictSsl = declared('strict-ssl');
  if (rawStrictSsl !== undefined) {
    // strict-ssl is typed Boolean-only, so parseField turns just 'true'/'false'
    // (plus '' -> true and the null/undefined literals) into non-strings and
    // leaves everything else a truthy string: '0', 'no' and 'off' all keep TLS
    // verification on in pnpm. Only an explicit 'false' turns it off.
    setStrictSsl(env, rawStrictSsl !== 'false');
  }
  setProxies(env, {
    // The spelling npm reads natively, which it can still only read from its own
    // project config. pnpm prefers `no-proxy` across every layer over `noproxy`
    // across every layer, so bridgeNoProxy runs after this and overwrites it.
    noProxy: bridged('noproxy'),
  });
  return proxies;
}

function bridgeNpmrcSources(
  env: NpmConfigEnv,
  root: string,
  workspaceDir: string,
  scope: string | null,
  authIniPath: string,
  pnpmVersion: string,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): ProxyDeclarations {
  // The file npm resolves as its project config, beside the package.json the
  // spawn runs from.
  const projectRaw = readNpmrcOrWarn(join(root, '.npmrc'));
  // pnpm reads exactly one workspace .npmrc, beside the workspace manifest it
  // walked up to, and merges it over auth.ini. That file is npm's own only when
  // the two directories coincide; above the spawn's, it is a source only pnpm
  // reads, so its entries have to be bridged rather than left to npm.
  const workspaceRaw =
    workspaceDir === root
      ? projectRaw
      : readNpmrcOrWarn(join(workspaceDir, '.npmrc'));
  const authIniRaw = readNpmrcOrWarn(authIniPath);
  // Highest pnpm precedence first.
  const sources: PnpmNpmrcSource[] = [];
  if (workspaceRaw) {
    sources.push({
      dir: workspaceDir,
      npmNative: workspaceDir === root,
      ...readPnpmNpmrcEntries(workspaceRaw, pnpmVersion, true),
    });
  }
  if (authIniRaw) {
    sources.push({
      dir: dirname(authIniPath),
      npmNative: false,
      ...readPnpmNpmrcEntries(authIniRaw, pnpmVersion, false),
    });
  }
  if (sources.length === 0) {
    return {};
  }
  const projectNpmrc = projectRaw ?? new Map();

  /** The highest source declaring `key`; an empty value still shadows the rest. */
  const declaringSource = (key: string): PnpmNpmrcSource | undefined =>
    sources.find((source) => source.map.has(key));
  /**
   * What pnpm resolves from these files, npm-native or not: a value it derives
   * another setting from is one npm does not derive for itself.
   */
  const declaredValue = (key: string): string | undefined =>
    declaringSource(key)?.map.get(key) || undefined;
  /** That source, unless npm reads it for itself and needs no bridging. */
  const bridging = (key: string): PnpmNpmrcSource | undefined => {
    const source = declaringSource(key);
    return source?.npmNative === false ? source : undefined;
  };
  // An empty value declares nothing to derive from: pnpm's own readers re-check
  // for an empty registry, and npm skips an empty env value outright. Deriving
  // from one is what does damage (an empty cafile resolves to its own directory).
  const bridgedValue = (key: string): string | undefined =>
    bridging(key)?.map.get(key) || undefined;

  // A registry already injected from the yaml or env outranks these files in
  // pnpm, so it keeps winning here.
  const registry = bridgedValue('registry');
  if (!env['npm_config_registry'] && registry) {
    setRegistry(env, registry);
  }
  const scopedRegistry = scope ? bridgedValue(`${scope}:registry`) : undefined;
  if (scope && !env[`npm_config_${scope}:registry`] && scopedRegistry) {
    setScopedRegistry(env, scope, scopedRegistry);
  }
  // Every dart is copied, not just the contacted registry's: npm resolves auth
  // per fetched URI and sends only the matching key, so a tarball served from a
  // second authenticated host keeps working. Filtering here would strip it.
  for (const source of sources) {
    for (const [key, value] of source.map) {
      // A key a higher source declares is that source's to decide, whether it
      // bridges the value or leaves it to npm.
      if (!key.startsWith('//') || declaringSource(key) !== source) {
        continue;
      }
      // npm has no tokenHelper setting and pnpm ignores one that arrives through
      // the environment, so bridging it would only put a command line in the
      // child's environment. pnpm also refuses to run a helper from any file but
      // its user auth config, so one here stands for no credential the fetch
      // would have had. `:cert`/`:key` carry inline PEM, which npm has no
      // registry-scoped form for, so they go in flat below instead.
      if (
        source.npmNative ||
        key.endsWith(':tokenHelper') ||
        key.endsWith(':cert') ||
        key.endsWith(':key')
      ) {
        continue;
      }
      // The env checks keep the URL-scoped env tier above these files, matching
      // pnpm's merge order: pnpm_config_ spellings are already in the overlay
      // (applyUrlScopedEnvConfig); ambient npm_config_ ones pnpm reads must stay
      // unbridged, or the overlaid value would shadow them out of the merge.
      if (
        env[`npm_config_${key}`] !== undefined ||
        (!managerIgnoresEnv(key) &&
          readNpmConfigEnv(process.env, key) !== undefined)
      ) {
        continue;
      }
      env[`npm_config_${key}`] = value;
    }
  }

  // The rescoped credentials went in through the dart loop above, since that is
  // the form they carry by the time pnpm merges them. What is left is naming the
  // ones npm will not get: a file npm reads itself contributes none, because npm
  // rejects bare auth in its own config (ERR_INVALID_AUTH) before any overlay
  // matters.
  const bareKeys = new Set<string>();
  const credentialDarts = new Set<string>();
  for (const source of sources) {
    if (source.npmNative || !source.dart) {
      continue;
    }
    for (const key of source.rescoped) {
      bareKeys.add(key);
      credentialDarts.add(source.dart);
    }
  }

  const contacted = contactedRegistry(
    env,
    projectNpmrc,
    scope,
    managerIgnoresEnv
  );
  const contactedDart = nerfDart(contacted);
  // A withheld credential is invisible in npm's own error, so name it, unless
  // npm already finds one for that registry among the sources visible here. A
  // user-level ~/.npmrc is not one, so the message states only what was
  // withheld rather than predicting how the request will fail.
  if (
    bareKeys.size > 0 &&
    contactedDart &&
    !credentialDarts.has(contactedDart) &&
    !hasCredentials(env, projectNpmrc, contactedDart, managerIgnoresEnv)
  ) {
    warnUnscopedCredential(contactedDart, [...bareKeys]);
  }

  // Flat TLS/proxy keys are part of pnpm's auth-config inheritance set
  // (RAW_AUTH_CFG_KEYS) and are written to auth.ini by `pnpm config set`, so
  // bridge them too.
  const cafileSource = bridging('cafile');
  const cafile = bridgedValue('cafile');
  if (cafileSource && cafile) {
    // From 11.2.0 pnpm resolves a relative cafile against the directory of the
    // file that declared it, not the workspace root; before that its only reader
    // is loadCAFile, a bare readFileSync on the raw value, so it lands on the
    // cwd the command runs in (the workspace root for a migrate). Neither
    // expands a leading `~`. npm ignores a cafile it cannot open, so getting the
    // base wrong drops the trust anchor with no diagnostic at all.
    const base = gte(pnpmVersion, '11.2.0') ? cafileSource.dir : root;
    setCafile(env, resolve(base, cafile));
  }
  // npm reads inline `ca` PEM only as a flat (global) key, and pnpm does not
  // source-scope trust anchors, so it needs no pin check.
  const caSource = bridging('ca');
  if (caSource) {
    env['npm_config_ca'] = caSource.map.get('ca');
  }
  // `cert`/`key` are client TLS material, which pnpm pins to a registry the same
  // way it pins credentials, so by here they are darted. npm has no
  // registry-scoped inline form (its //host/:certfile / :keyfile keys take
  // paths, not PEM) and npm_config_cert presents the certificate to every host
  // npm contacts, so only the pair pinned to the registry npm will actually
  // contact can go in, and it goes in flat.
  // Every tier is read here, the URL-scoped env one above the files and the
  // project file among them: npm's own registry-scoped TLS keys take paths
  // (certfile/keyfile), so inline PEM cannot reach it in scoped form from any of
  // them, npm-native file included.
  for (const key of ['cert', 'key'] as const) {
    if (!contactedDart) {
      continue;
    }
    const dartKey = `${contactedDart}:${key}`;
    const value =
      env[`npm_config_${dartKey}`] ||
      // The same ambient tier the dart loop honors: from 11.6.0 pnpm reads a
      // URL-scoped npm_config_ entry the spawn would otherwise pass straight
      // through in a form npm makes no use of.
      (managerIgnoresEnv(dartKey)
        ? undefined
        : readNpmConfigEnv(process.env, dartKey)) ||
      declaringSource(dartKey)?.map.get(dartKey);
    if (value) {
      env[`npm_config_${key}`] = value;
    } else if (
      projectRaw &&
      // Read as npm resolves it: it expands a `${VAR}` in the key before it
      // looks the setting up, so a placeholder-spelled one still reaches it.
      readExpandedKey(projectRaw, key, expandNpmEnvVars) !== undefined
    ) {
      // npm reads this one out of its own project config and presents it to
      // every host it contacts, where pnpm pinned it to a registry this fetch
      // never reaches. The `null` literal is what cancels a file value at npm's
      // env tier; an empty one leaves the file's in place (measured on npm 9,
      // 10 and 11).
      env[`npm_config_${key}`] = 'null';
    }
  }
  const strictSslSource = bridging('strict-ssl');
  if (strictSslSource) {
    // strict-ssl is typed Boolean-only, so parseField turns just 'true'/'false'
    // (plus '' -> true and the null/undefined literals) into non-strings and
    // leaves everything else a truthy string: '0', 'no' and 'off' all keep TLS
    // verification on in pnpm. Only an explicit 'false' turns it off.
    setStrictSsl(env, strictSslSource.rawStrictSsl === 'false' ? false : true);
  }
  return {
    proxy: declaredValue('proxy'),
    httpProxy: declaredValue('http-proxy'),
    httpsProxy: declaredValue('https-proxy'),
  };
}

/**
 * The proxy-bypass list is the one npmrc key whose spelling differs. In these
 * files pnpm 11 honors `no-proxy` and ignores `noproxy`, where npm does the
 * exact opposite (it warns about `no-proxy` as an unknown config and moves on).
 * pnpm 10.x honors both, so only the spelling npm cannot read needs bridging on
 * either line. Either way pnpm's `no-proxy` never reaches the spawned npm from
 * any file it reads, so the layer that wins in pnpm has to be re-spelled. A
 * `noProxy` in pnpm-workspace.yaml outranks every one of them and is applied
 * after this.
 */
function bridgeNoProxy(
  env: NpmConfigEnv,
  npmrcPaths: string[],
  pnpmVersion: string
): void {
  const value = fileNoProxy(npmrcPaths, pnpmVersion);
  if (value) {
    setProxies(env, { noProxy: value });
  }
}

/** The bypass list the highest of `npmrcPaths` to declare one contributes. */
function fileNoProxy(
  npmrcPaths: string[],
  pnpmVersion: string
): string | undefined {
  for (const path of npmrcPaths) {
    const npmrc = readPnpmNpmrcMap(path, pnpmVersion);
    // Declaring the key empty is pnpm's way of clearing a list it inherits, so
    // presence settles the layer and an empty value stops the search here.
    if (!npmrc?.has('no-proxy')) {
      continue;
    }
    const value = npmrc.get('no-proxy');
    // npm ignores `no-proxy` in the file it does read, so the value never goes
    // through npm's own expansion under that key; expand it with pnpm's grammar.
    return value ? expandPnpmEnvVars(value) : undefined;
  }
  return undefined;
}

/**
 * The registry the spawned npm will contact, as far as this process can see: a
 * scoped registry for the package, else the default, else npm's own. A registry
 * declared only in a user-level ~/.npmrc is not visible here, which leaves the
 * comparison covering the sources that can redirect the request to a host the
 * user never configured.
 */
function contactedRegistry(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  scope: string | null,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): string {
  // npm's pickRegistry falls through on a falsy value, so a setting that
  // expanded to nothing lands on the next one rather than on an empty host.
  return (
    (scope
      ? npmResolved(env, projectNpmrc, `${scope}:registry`, managerIgnoresEnv)
      : undefined) ||
    npmResolved(env, projectNpmrc, 'registry', managerIgnoresEnv) ||
    DEFAULT_REGISTRY
  );
}

/**
 * Writes the proxy pair pnpm ends up with, once every tier has declared. The
 * registry npm is about to contact decides whether an http-only proxy is worth
 * bridging, and what npm reads for itself decides whether a value needs to be.
 */
function applyResolvedProxies(
  env: NpmConfigEnv,
  tiers: ProxyDeclarations[],
  root: string,
  scope: string | null,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): void {
  const projectNpmrc = readNpmrcOrWarn(join(root, '.npmrc')) ?? new Map();
  setProxies(
    env,
    resolveProxies(
      tiers,
      contactedRegistry(env, projectNpmrc, scope, managerIgnoresEnv),
      (key) =>
        (managerIgnoresEnv(key)
          ? undefined
          : readNpmConfigEnv(process.env, key)) ??
        readExpandedKey(projectNpmrc, key, expandNpmEnvVars)
    )
  );
}

function npmResolved(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  key: string,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): string | undefined {
  // npm's env tier outranks the .npmrc, but the spawn strips a bridged ambient
  // npm_config_* the manager ignores (mergeNpmConfigEnv), and every key read
  // here is bridged, so a value npm never sees is not counted either.
  const ambient = managerIgnoresEnv(key)
    ? undefined
    : readNpmConfigEnv(process.env, key);
  const declared =
    env[`npm_config_${key}`] ??
    ambient ??
    readExpandedKey(projectNpmrc, key, expandNpmEnvVars);
  // npm trims a value before it expands one (parseField), so a blank value
  // collapses while a padded reference still resolves.
  return declared === undefined ? undefined : expandNpmEnvVars(declared.trim());
}

function hasCredentials(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  dart: string,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): boolean {
  return hasCredentialFor(dart, (key) =>
    npmResolved(env, projectNpmrc, key, managerIgnoresEnv)
  );
}

/** pnpm accepts `~/` and `~\` on every platform; npm accepts `~\` on Windows only. */
const PNPM_HOME_PATH = /^~[/\\]/;
const NPM_HOME_PATH = process.platform === 'win32' ? /^~[/\\]/ : /^~\//;

/** Both tools normalize a config path this way: `~` for the home directory,
 *  else the cwd the command runs in. That cwd is the config root the spawn
 *  uses, not this process's, which a migrate from a subdirectory differs from. */
function resolveConfigPath(
  value: string,
  homePattern: RegExp,
  root: string
): string {
  return homePattern.test(value)
    ? resolve(homedir(), value.slice(2))
    : resolve(root, value);
}

/**
 * The file pnpm >= 11 authenticates from. Its selection chain is followed here
 * minus the two CLI links, which nx never passes.
 * See loadNpmrcConfig in pnpm's config reader.
 */
function getPnpmUserConfigPath(pnpmVersion: string, root: string): string {
  // Read first: pnpm parses the global config.yaml before the selector
  // applies, so a malformed one aborts even when the env names the auth file.
  const globalYaml = readPnpmGlobalConfigYaml();
  let selected =
    readPnpmEnvVar('npmrc_auth_file', pnpmVersion) ??
    readPnpmEnvVar('userconfig', pnpmVersion);
  if (selected === undefined) {
    const fromYaml = globalYaml?.['npmrcAuthFile'];
    selected =
      (typeof fromYaml === 'string' ? fromYaml : undefined) ||
      // The last link is npm's own setting, which npm then reads for itself.
      readEnvVar(process.env, 'npm_config_userconfig') ||
      undefined;
  }
  return selected
    ? resolveConfigPath(selected, PNPM_HOME_PATH, root)
    : join(homedir(), '.npmrc');
}

/**
 * The file npm resolves as its own user config. npm documents `userconfig` as
 * settable from the environment and the command line only, never from another
 * config file, so its env tier over the `~/.npmrc` default is the whole chain.
 */
function getNpmUserConfigPath(root: string): string {
  const configured = readNpmConfigEnv(process.env, 'userconfig');
  return configured
    ? resolveConfigPath(
        expandNpmEnvVars(configured.trim()),
        NPM_HOME_PATH,
        root
      )
    : join(homedir(), '.npmrc');
}

/**
 * Reports a credential pnpm produces by running a token helper, which npm has
 * no setting for and no way to reproduce. Both supported lines take a helper
 * only from the user config pnpm resolves (10.x getAuthHeadersFromConfig reads
 * it from userSettings alone; 11 additionally aborts the command outright with
 * TOKEN_HELPER_IN_PROJECT_CONFIG when one reaches it from any other file), so
 * `userConfigPath` is the one place worth reading.
 */
function reportTokenHelper(
  env: NpmConfigEnv,
  root: string,
  scope: string | null,
  userConfigPath: string,
  pnpmVersion: string,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): void {
  const userConfig = readPnpmNpmrcMap(userConfigPath, pnpmVersion);
  if (!userConfig) {
    return;
  }
  const projectNpmrc = readNpmrcOrWarn(join(root, '.npmrc')) ?? new Map();
  const contactedDart = nerfDart(
    contactedRegistry(env, projectNpmrc, scope, managerIgnoresEnv)
  );
  // Where pnpm pins a `tokenHelper` written without a registry prefix.
  const pinnedDart = gte(pnpmVersion, '11.0.0')
    ? // 11 rescopes it per file, onto the registry that same file declares
      // (rescopeUnscopedCreds), expanding `${VAR}` before reading it off.
      nerfDart(
        expandPnpmEnvVars(userConfig.get('registry') ?? '') || DEFAULT_REGISTRY
      )
    : // 10.x pins it onto the registry that wins overall instead
      // (getAuthHeadersFromConfig keys it on allSettings.registry). The default
      // registry, never a scoped one: pnpm keys the helper on
      // `registry` alone, so a scoped package goes elsewhere without it.
      nerfDart(
        npmResolved(env, projectNpmrc, 'registry', managerIgnoresEnv) ||
          DEFAULT_REGISTRY
      );
  if (
    !contactedDart ||
    !declaresTokenHelper(userConfig, contactedDart, pinnedDart)
  ) {
    return;
  }
  // npm opens its own user config, so a plain credential sitting beside the
  // helper is one npm still sends. A file pnpm was pointed at on its own is one
  // npm never opens, and nothing in it counts.
  const npmReadsUserConfig = userConfigPath === getNpmUserConfigPath(root);
  const npmVisible = (key: string): string | undefined => {
    const declared = npmResolved(env, projectNpmrc, key, managerIgnoresEnv);
    if (declared !== undefined || !npmReadsUserConfig) {
      return declared;
    }
    const fromUserConfig = readExpandedKey(userConfig, key, expandNpmEnvVars);
    return fromUserConfig === undefined
      ? undefined
      : expandNpmEnvVars(fromUserConfig.trim());
  };
  if (!hasCredentialFor(contactedDart, npmVisible)) {
    warnTokenHelper(contactedDart);
  }
}

/**
 * Whether the credential pnpm presents at `dart` comes from a token helper. A
 * helper outranks every other credential for that registry, whichever layer
 * those came from (credsToHeader), so finding one settles what pnpm sends.
 */
function declaresTokenHelper(
  userConfig: Map<string, string>,
  dart: string,
  pinnedDart: string | null
): boolean {
  // pnpm expands `${VAR}` in this file's values as well as its keys, and a value
  // resolving to nothing declares no helper at all.
  const declared = (key: string): string =>
    expandPnpmEnvVars(
      readExpandedKey(userConfig, key, expandPnpmEnvVars) ?? ''
    );
  return (
    registryKeysFor(dart).some((key) => declared(`${key}:tokenHelper`)) ||
    (pinnedDart === dart && !!declared('tokenHelper'))
  );
}

let warnedTokenHelper = false;
// The nerf dart only, for the same reason warnUnscopedCredential uses it. The
// helper's command line stays out too: it is what produces the credential.
function warnTokenHelper(dart: string): void {
  if (warnedTokenHelper) {
    return;
  }
  warnedTokenHelper = true;
  logger.warn(
    `pnpm runs a token helper to authenticate with ${dart}, which npm cannot do, so packages will be fetched from there without that credential. Store the token the helper returns as "${dart}:_authToken=..." in a file npm reads if it should authenticate there.`
  );
}

let warnedUnscopedCredential = false;
// The nerf dart, not the registry URL: a registry URL can carry its own basic
// auth, which would then be in every console and CI log the warning reaches.
function warnUnscopedCredential(dart: string, keys: string[]): void {
  if (warnedUnscopedCredential) {
    return;
  }
  warnedUnscopedCredential = true;
  const scoped = keys.map((key) => `"${dart}:${key}=..."`).join(', ');
  logger.warn(
    `A credential in pnpm's auth.ini is not scoped to a registry, so it was not used for ${dart} when fetching packages. pnpm pins an unscoped credential to the registry that same file declares, and has deprecated the unscoped form. Scope it (${scoped}) to use it with this registry.`
  );
}

/**
 * Network settings pnpm honors from a yaml configuration file. `caFile`/
 * `cafile` is the one it accepts and then never uses (it loads a CA file from
 * the npmrc-family files alone, measured on 10.18.0 and 11.20.0), so that key
 * is deliberately not bridged; inline `ca`/`cert`/`key` declared here do reach
 * its fetch, unpinned, exactly as npm's own spelling of them does.
 */
function applyYamlNetworkSettings(
  env: NpmConfigEnv,
  settings: PnpmWorkspaceSettings,
  applyNoProxy = true
): void {
  // Only the boolean turns verification off (rejectUnauthorized is
  // `strictSsl ?? true`, and the agent that carries it is built for
  // `strictSsl === false`), so any other declared value restores npm's default
  // over a `strict-ssl=false` from a file below.
  if (settings.strictSsl !== undefined) {
    setStrictSsl(env, settings.strictSsl !== false);
  }
  if (settings.ca) {
    env['npm_config_ca'] = settings.ca;
  }
  for (const key of ['cert', 'key'] as const) {
    if (settings[key]) {
      env[`npm_config_${key}`] = settings[key];
    }
  }
  // pnpm honors either spelling and prefers noProxy when both are set. The
  // proxies themselves are resolved with every other tier's rather than here.
  if (applyNoProxy) {
    setProxies(env, { noProxy: settings.noProxy ?? settings.noproxy });
  }
}
