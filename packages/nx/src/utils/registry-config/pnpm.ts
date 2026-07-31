import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { gte, lt } from 'semver';
import {
  getPnpmConfigDir,
  readPnpmYamlConfig,
} from '../package-manager-config/pnpm-config';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import { logger } from '../logger';
import {
  expandNpmEnvVars,
  expandPnpmEnvVars,
  getPackageScope,
  hasCredentialFor,
  ignoresNpmConfigEnv,
  nerfDart,
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
 *   npmrc/env/CLI registry selection.
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
 */

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
const BARE_AUTH_KEYS = [
  '_authToken',
  '_auth',
  'username',
  '_password',
] as const;

interface PnpmWorkspaceSettings {
  registries?: Record<string, string>;
  strictSsl?: boolean;
  proxy?: string;
  httpsProxy?: string;
  noProxy?: string;
  // The one key here pnpm also answers to in npm's spelling. Its siblings are
  // camelCase-only, so nothing else needs an alias.
  noproxy?: string;
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

  const settings = readPnpmWorkspaceSettings(root);
  const scope = getPackageScope(packageName);
  // Kept identical to the predicate the caller hands mergeNpmConfigEnv at spawn
  // time, which drops every ambient npm_config_* this answers true for.
  const managerIgnoresEnv = ignoresNpmConfigEnv('pnpm', pnpmVersion);

  if (lt(pnpmVersion, '11.0.0')) {
    // The replace wipes the npmrc/env/CLI selection outright, so the scoped key
    // is forced to the yaml default when the map has no entry for the scope. A
    // scoped-only map leaves pnpm no default at all, which crashes it on an
    // unscoped target but resolves a scoped one fine, so npm's own default is
    // left in place rather than aimed at a registry pnpm uses only for that
    // scope.
    if (settings.registries?.default) {
      setRegistry(env, settings.registries.default);
    }
    const pick = scope
      ? (settings.registries?.[scope] ?? settings.registries?.default)
      : undefined;
    if (scope && pick) {
      setScopedRegistry(env, scope, pick);
    }
    // auth.ini is an 11.x file, so the workspace .npmrc is the only layer whose
    // bypass list can need re-spelling here.
    bridgeNoProxy(env, root);
    applyYamlNetworkSettings(env, settings);
    // On this version line pnpm's user config is npm's own (no auth.ini, no
    // npmrcAuthFile), always a file npm reads for itself.
    reportTokenHelper(
      env,
      root,
      scope,
      getNpmUserConfigPath(root),
      'resolved-registry',
      managerIgnoresEnv
    );
    return env;
  }

  // The yaml-only keys go in at npm's env tier, where npm's per-key chain
  // reproduces pnpm's ordering: a project .npmrc @scope:registry still beats an
  // injected default, while an injected @scope:registry beats the project
  // .npmrc scoped key (yaml @scope > npmrc @scope in pnpm).
  if (scope && settings.registries?.[scope]) {
    setScopedRegistry(env, scope, settings.registries[scope]);
  }
  const defaultRegistry =
    readPnpmEnvVar('registry', pnpmVersion) ?? settings.registries?.default;
  if (defaultRegistry) {
    setRegistry(env, defaultRegistry);
  }

  const authIniPath = getAuthIniPath();
  applyUrlScopedEnvConfig(env, pnpmVersion);
  bridgeAuthIni(env, root, scope, authIniPath, pnpmVersion, managerIgnoresEnv);
  reportTokenHelper(
    env,
    root,
    scope,
    getPnpmUserConfigPath(pnpmVersion, root),
    'declaring-file',
    managerIgnoresEnv
  );

  // resolveNoProxy takes the bypass list across every layer below, so the yaml
  // does not write it here.
  applyYamlNetworkSettings(env, settings, false);
  applyEnvNetworkSettings(env, pnpmVersion);
  const noProxy = resolveNoProxy(settings, root, authIniPath, pnpmVersion);
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

/**
 * The TLS and proxy settings pnpm >= 11 takes from its own `PNPM_CONFIG_*`
 * prefix. They outrank pnpm-workspace.yaml, so they are applied after it.
 * `cafile` is left out on purpose: pnpm accepts it and then never uses it for
 * the fetch, the same dead config as the yaml key.
 */
function applyEnvNetworkSettings(env: NpmConfigEnv, pnpmVersion: string): void {
  const strictSsl = readPnpmEnvVar('strict_ssl', pnpmVersion);
  if (strictSsl !== undefined) {
    // parseField types this Boolean, so only an explicit 'false' turns
    // verification off.
    setStrictSsl(env, strictSsl !== 'false');
  }
  setProxies(env, {
    httpProxy: readPnpmEnvVar('proxy', pnpmVersion),
    httpsProxy: readPnpmEnvVar('https_proxy', pnpmVersion),
  });
}

/**
 * The proxy-bypass list pnpm >= 11 ends up using. It reads the `no-proxy`
 * spelling and only falls back to `noproxy`, so the spelling decides before the
 * layer does: a workspace .npmrc `no-proxy` beats a pnpm-workspace.yaml
 * `noproxy`. Within one spelling the env sits above the yaml, which sits above
 * the files.
 * See createPackageManagerNetworkConfig in pnpm's config reader.
 */
function resolveNoProxy(
  settings: PnpmWorkspaceSettings,
  root: string,
  authIniPath: string,
  pnpmVersion: string
): string | undefined {
  const envNoProxy = readPnpmEnvVar('no_proxy', pnpmVersion);
  if (envNoProxy) {
    return envNoProxy;
  }
  if (settings.noProxy) {
    return settings.noProxy;
  }
  const fromFiles = fileNoProxy(root, authIniPath);
  if (fromFiles) {
    return fromFiles;
  }
  return readPnpmEnvVar('noproxy', pnpmVersion) ?? settings.noproxy;
}

function readPnpmWorkspaceSettings(root: string): PnpmWorkspaceSettings {
  const path = join(root, 'pnpm-workspace.yaml');
  const doc = readPnpmYamlConfig(path);
  if (doc === null) {
    return {};
  }
  if (doc === 'invalid') {
    // pnpm aborts on a file it cannot parse, so there is no resolution left to
    // reproduce. Propagating to the caller's fall-open warns instead of
    // silently treating the workspace as declaring no registry.
    throw new Error(`The pnpm workspace file at ${path} could not be read.`);
  }
  return doc as PnpmWorkspaceSettings;
}

function getAuthIniPath(): string {
  return join(getPnpmConfigDir(process.env), 'auth.ini');
}

// pnpm warns and resolves on from the remaining layers when an npmrc-family
// file exists but cannot be read, so mirror it: warn, absent semantics.
const warnedUnreadableFiles = new Set<string>();
function readPnpmNpmrcMap(path: string): Map<string, string> | null {
  const map = readNpmrcMap(path);
  if (map !== 'unreadable') {
    return map;
  }
  if (!warnedUnreadableFiles.has(path)) {
    warnedUnreadableFiles.add(path);
    logger.warn(
      `Could not read ${path}; resolving the pnpm registry configuration without it, the way pnpm itself does.`
    );
  }
  return null;
}

function bridgeAuthIni(
  env: NpmConfigEnv,
  root: string,
  scope: string | null,
  authIniPath: string,
  pnpmVersion: string,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): void {
  const rawAuthIni = readPnpmNpmrcMap(authIniPath);
  if (!rawAuthIni) {
    return;
  }
  // pnpm's reader runs envReplace on every auth.ini key as well as every value,
  // and npm's own env-tier expansion uses a different grammar, so expand with
  // pnpm's here. Rebuilding in file order lets a later key that resolves to the
  // same setting win, the way both readers assign.
  const authIni = new Map<string, string>();
  for (const [key, value] of rawAuthIni) {
    authIni.set(expandPnpmEnvVars(key), value);
  }
  // parseField decides a Boolean-typed setting from the literal value, before it
  // expands any `${VAR}`, so strict-ssl has to be read pre-expansion.
  const rawStrictSsl = authIni.get('strict-ssl');
  for (const [key, value] of authIni) {
    authIni.set(key, expandPnpmEnvVars(value));
  }
  const projectNpmrc = readPnpmNpmrcMap(join(root, '.npmrc')) ?? new Map();
  // An empty value declares nothing: pnpm's own readers re-check for an empty
  // registry, and npm skips an empty env value outright. Deriving from one is
  // what does damage (an empty cafile resolves to auth.ini's own directory).
  const declared = (key: string): string | undefined =>
    authIni.get(key) || undefined;

  const authIniRegistry = declared('registry');
  // A registry already injected from the yaml/env or defined in the workspace
  // .npmrc outranks auth.ini in pnpm, so it keeps winning here.
  if (
    !env['npm_config_registry'] &&
    !projectNpmrc.has('registry') &&
    authIniRegistry
  ) {
    setRegistry(env, authIniRegistry);
  }
  const authIniScopedRegistry = scope
    ? declared(`${scope}:registry`)
    : undefined;
  if (
    scope &&
    !env[`npm_config_${scope}:registry`] &&
    !projectNpmrc.has(`${scope}:registry`) &&
    authIniScopedRegistry
  ) {
    setScopedRegistry(env, scope, authIniScopedRegistry);
  }
  for (const [key, value] of authIni) {
    // The env checks keep the URL-scoped env tier above this file, matching
    // pnpm's merge order: pnpm_config_ spellings are already in the overlay
    // (applyUrlScopedEnvConfig); ambient npm_config_ ones pnpm reads must stay
    // unbridged, or the overlaid value would shadow them out of the merge.
    if (
      !key.startsWith('//') ||
      env[`npm_config_${key}`] !== undefined ||
      (!managerIgnoresEnv(key) &&
        readNpmConfigEnv(process.env, key) !== undefined) ||
      projectNpmrc.has(key)
    ) {
      continue;
    }
    // npm has no tokenHelper setting and pnpm ignores one that arrives through
    // the environment, so bridging it would only put a command line in the
    // child's environment. pnpm also refuses to run a helper from any file but
    // its user auth config, so one here stands for no credential the fetch
    // would have had.
    if (key.endsWith(':tokenHelper')) {
      continue;
    }
    env[`npm_config_${key}`] = value;
  }

  // pnpm's getDefaultCreds applies a bare global _auth/_authToken/username/
  // _password (no nerf-dart prefix); npm honors auth only in the nerf-darted
  // form, so re-key it onto the registry auth.ini itself declares, or npmjs when
  // it declares none. That is where pnpm pins an unscoped credential from 11.4.0
  // (rescopeUnscopedCreds). Earlier 11.x paired it with whichever registry won
  // overall, which let a workspace-local .npmrc or pnpm-workspace.yaml aim a
  // user-level credential at a host of its choosing (CVE-2026-50017), so the
  // pin is applied for those versions too rather than reproducing the hole.
  // A workspace .npmrc bare key is not a source here either; npm reads that file
  // itself and rejects bare auth in it (ERR_INVALID_AUTH).
  const credentialDart = nerfDart(authIniRegistry ?? DEFAULT_REGISTRY);
  const bareKeys = BARE_AUTH_KEYS.filter((key) => declared(key) !== undefined);
  if (credentialDart) {
    for (const bareKey of bareKeys) {
      const dartKey = `${credentialDart}:${bareKey}`;
      // Same URL-scoped env precedence as the dart loop above: an ambient
      // credential pnpm reads at that dart outranks the rescoped bare one.
      if (
        env[`npm_config_${dartKey}`] === undefined &&
        (managerIgnoresEnv(dartKey) ||
          readNpmConfigEnv(process.env, dartKey) === undefined) &&
        !projectNpmrc.has(dartKey)
      ) {
        env[`npm_config_${dartKey}`] = authIni.get(bareKey);
      }
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
    bareKeys.length > 0 &&
    contactedDart &&
    credentialDart !== contactedDart &&
    !hasCredentials(env, projectNpmrc, contactedDart, managerIgnoresEnv)
  ) {
    warnUnscopedCredential(contactedDart, bareKeys);
  }

  // Flat TLS/proxy keys are part of pnpm's auth-config inheritance set
  // (RAW_AUTH_CFG_KEYS) and are written to auth.ini by `pnpm config set`, so
  // bridge them too (a workspace .npmrc that sets the same key still wins).
  const unbridged = (key: string): boolean =>
    !projectNpmrc.has(key) && authIni.has(key);
  const cafile = unbridged('cafile') ? declared('cafile') : undefined;
  if (cafile) {
    // From 11.2.0 pnpm resolves a relative cafile against the directory of the
    // file that declared it, not the workspace root; before that its only reader
    // is loadCAFile, a bare readFileSync on the raw value, so it lands on the
    // cwd the command runs in (the workspace root for a migrate). Neither
    // expands a leading `~`. npm ignores a cafile it cannot open, so getting the
    // base wrong drops the trust anchor with no diagnostic at all.
    const base = gte(pnpmVersion, '11.2.0') ? dirname(authIniPath) : root;
    setCafile(env, resolve(base, cafile));
  }
  // npm reads inline `ca` PEM only as a flat (global) key, and pnpm does not
  // source-scope trust anchors, so it needs no pin check.
  if (unbridged('ca')) {
    env['npm_config_ca'] = authIni.get('ca');
  }
  // `cert`/`key` are client TLS material, which pnpm pins to the source registry
  // alongside the credentials, but npm has no registry-scoped inline form (its
  // //host/:certfile / :keyfile keys take paths, not PEM) and npm_config_cert
  // presents the certificate to every host npm contacts. Bridge them only when
  // the registry npm will contact is the one they are pinned to.
  if (credentialDart && credentialDart === contactedDart) {
    for (const key of ['cert', 'key'] as const) {
      if (unbridged(key)) {
        env[`npm_config_${key}`] = authIni.get(key);
      }
    }
  }
  if (unbridged('strict-ssl')) {
    // strict-ssl is typed Boolean-only, so parseField turns just 'true'/'false'
    // (plus '' -> true and the null/undefined literals) into non-strings and
    // leaves everything else a truthy string: '0', 'no' and 'off' all keep TLS
    // verification on in pnpm. Only an explicit 'false' turns it off.
    setStrictSsl(env, rawStrictSsl === 'false' ? false : true);
  }
  setProxies(env, {
    httpProxy: unbridged('proxy') ? authIni.get('proxy') : undefined,
    httpsProxy: unbridged('https-proxy')
      ? authIni.get('https-proxy')
      : undefined,
  });
}

/**
 * The proxy-bypass list is the one npmrc key whose spelling differs. In these
 * files pnpm 11 honors `no-proxy` and ignores `noproxy`, where npm does the
 * exact opposite (it warns about `no-proxy` as an unknown config and moves on).
 * pnpm 10.x honors both, so only the spelling npm cannot read needs bridging on
 * either line. Either way pnpm's `no-proxy` never reaches the spawned npm from
 * any file, the workspace .npmrc included, and the layer that wins in pnpm has
 * to be re-spelled. A `noProxy` in pnpm-workspace.yaml outranks both files and
 * is applied after this.
 */
function bridgeNoProxy(env: NpmConfigEnv, root: string): void {
  const value = fileNoProxy(root);
  if (value) {
    setProxies(env, { noProxy: value });
  }
}

function fileNoProxy(root: string, authIniPath?: string): string | undefined {
  const projectNpmrc = readPnpmNpmrcMap(join(root, '.npmrc'));
  // The workspace .npmrc outranks auth.ini, and declaring the key empty there
  // is pnpm's way of clearing an inherited bypass list.
  const value = projectNpmrc?.has('no-proxy')
    ? projectNpmrc.get('no-proxy')
    : authIniPath && readPnpmNpmrcMap(authIniPath)?.get('no-proxy');
  // npm ignores `no-proxy` in the file it does read, so the value never goes
  // through npm's own expansion under that key; expand it with pnpm's grammar.
  return value ? expandPnpmEnvVars(value) : undefined;
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

function npmResolved(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  key: string,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): string | undefined {
  // npm's env tier outranks the .npmrc, but the spawn strips every ambient
  // npm_config_* the manager ignores (mergeNpmConfigEnv), so a value it never
  // saw is not counted here either.
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
 * minus the two CLI links, which nx never passes. Null when the global
 * config.yaml that could name the file cannot be read, leaving the choice
 * unknown.
 * See loadNpmrcConfig in pnpm's config reader.
 */
function getPnpmUserConfigPath(
  pnpmVersion: string,
  root: string
): string | null {
  let selected =
    readPnpmEnvVar('npmrc_auth_file', pnpmVersion) ??
    readPnpmEnvVar('userconfig', pnpmVersion);
  if (selected === undefined) {
    const globalYaml = readPnpmYamlConfig(
      join(getPnpmConfigDir(process.env), 'config.yaml')
    );
    if (globalYaml === 'invalid') {
      return null;
    }
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
 * Where pnpm pins a `tokenHelper` written without a registry prefix. 11
 * rescopes it per file, onto the registry that same file declares
 * (rescopeUnscopedCreds); 10.x pins it onto the registry that wins overall
 * instead (getAuthHeadersFromConfig keys it on allSettings.registry).
 */
type UnscopedHelperPin = 'declaring-file' | 'resolved-registry';

/**
 * Reports a credential pnpm produces by running a token helper, which npm has
 * no setting for and no way to reproduce. Both supported lines take a helper
 * only from the user config pnpm resolves (10.x getAuthHeadersFromConfig reads
 * it from userSettings alone; 11 additionally aborts the command outright with
 * TOKEN_HELPER_IN_PROJECT_CONFIG when one reaches it from any other file), so
 * `userConfigPath` is the one place worth reading. Null when the caller cannot
 * tell which file that is.
 */
function reportTokenHelper(
  env: NpmConfigEnv,
  root: string,
  scope: string | null,
  userConfigPath: string | null,
  unscopedPin: UnscopedHelperPin,
  managerIgnoresEnv: IgnoresNpmConfigEnv
): void {
  const userConfig = userConfigPath ? readPnpmNpmrcMap(userConfigPath) : null;
  if (!userConfig) {
    return;
  }
  const projectNpmrc = readPnpmNpmrcMap(join(root, '.npmrc')) ?? new Map();
  const contactedDart = nerfDart(
    contactedRegistry(env, projectNpmrc, scope, managerIgnoresEnv)
  );
  const pinnedDart =
    unscopedPin === 'declaring-file'
      ? // pnpm expands `${VAR}` in this file before reading the registry off it.
        nerfDart(
          expandPnpmEnvVars(userConfig.get('registry') ?? '') ||
            DEFAULT_REGISTRY
        )
      : // The default registry, never a scoped one: pnpm keys the helper on
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
 * Network settings pnpm honors from pnpm-workspace.yaml. `caFile`/`cafile` is
 * dead config there (pnpm loads CA material from the npmrc-family files only:
 * .npmrc, which npm reads natively, and auth.ini, bridged in bridgeAuthIni), so
 * the YAML key is deliberately not bridged.
 */
function applyYamlNetworkSettings(
  env: NpmConfigEnv,
  settings: PnpmWorkspaceSettings,
  applyNoProxy = true
): void {
  if (typeof settings.strictSsl === 'boolean') {
    setStrictSsl(env, settings.strictSsl);
  }
  setProxies(env, {
    httpProxy: settings.proxy,
    httpsProxy: settings.httpsProxy,
    // pnpm honors either spelling and prefers noProxy when both are set.
    noProxy: applyNoProxy ? (settings.noProxy ?? settings.noproxy) : undefined,
  });
}
