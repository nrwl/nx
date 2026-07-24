import { existsSync } from 'fs';
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
  type NpmConfigEnv,
} from './utils';

/*
 * pnpm registry resolution, by version line (behavior verified against the
 * published binaries):
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
 *   only `registries.default`. npm_config_* env vars are no longer read, and
 *   .npmrc is restricted to auth/registry/network keys. The per-package lookup
 *   is registries[scope] ?? registries.default. An `auth.ini` file in pnpm's
 *   config dir layers between the user and workspace .npmrc. Because pnpm
 *   ignores npm_config_* here, the overlay this builds is consumed by the
 *   spawned `npm pack` (and a forced `npm view`), not by `pnpm view`, which
 *   resolves natively.
 */

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
/** Credential keys pnpm accepts without a nerf-dart prefix. */
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
  // The one key on this surface that pnpm also answers to in npm's own
  // spelling. Its siblings are camelCase-only (verified on 11.2.2 and 11.9.0
  // against a proxy: `httpsproxy`, `HTTPSPROXY` and `https-proxy` are all
  // ignored), so nothing else here needs an alias.
  noproxy?: string;
}

export function getPnpmSpawnRegistryEnv(
  packageName: string,
  root: string,
  pnpmVersion: string | null
): NpmConfigEnv {
  const env: NpmConfigEnv = {};
  // Without a version we cannot reason about which surfaces this pnpm honors;
  // leave npm's own resolution untouched.
  if (!pnpmVersion || lt(pnpmVersion, '10.6.0')) {
    return env;
  }

  const settings = readPnpmWorkspaceSettings(root);
  const scope = getPackageScope(packageName);
  // The spawn drops ambient npm_config_* on the same lines this returns true for
  // (mergeNpmConfigEnv), so a resolver here reads the environment npm receives
  // only when it is false. Kept identical to the caller's spawn-time argument.
  const managerIgnoresEnv = ignoresNpmConfigEnv('pnpm', pnpmVersion);

  if (lt(pnpmVersion, '11.0.0')) {
    // Wholesale semantics: the map replaces the npmrc/env/CLI registry
    // selection outright, so the default has to be forced to the yaml default
    // and the scoped key to whichever entry pnpm would pick, even when that is
    // the yaml default shadowing a scoped key the workspace .npmrc declares.
    // A scoped-only map leaves pnpm no default at all, which crashes it on an
    // unscoped target (the replace wipes registries.default) but resolves a
    // scoped one fine, so npm's own default is left in place there rather than
    // aimed at a registry pnpm only uses for that scope.
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
    // This line has no auth.ini and no npmrcAuthFile: pnpm's user config is
    // npm's own, always a file npm reads for itself.
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

  // >= 11: per-key bridging. The yaml-only keys are injected at npm's env tier;
  // npm's per-key chain then reproduces pnpm's ordering: a project .npmrc
  // @scope:registry still beats an injected default (matching pnpm), while an
  // injected @scope:registry beats the project .npmrc scoped key (matching
  // yaml @scope > npmrc @scope).
  if (scope && settings.registries?.[scope]) {
    setScopedRegistry(env, scope, settings.registries[scope]);
  }
  const defaultRegistry =
    readPnpmEnvVar('registry', pnpmVersion) ?? settings.registries?.default;
  if (defaultRegistry) {
    setRegistry(env, defaultRegistry);
  }

  const authIniPath = getAuthIniPath();
  bridgeAuthIni(env, root, scope, authIniPath, pnpmVersion, managerIgnoresEnv);
  reportTokenHelper(
    env,
    root,
    scope,
    getPnpmUserConfigPath(pnpmVersion, root),
    'declaring-file',
    managerIgnoresEnv
  );

  // The bypass list resolves across all of these at once (resolveNoProxy), so
  // the yaml does not get to write it on its own here.
  applyYamlNetworkSettings(env, settings, false);
  applyEnvNetworkSettings(env, pnpmVersion);
  const noProxy = resolveNoProxy(settings, root, authIniPath, pnpmVersion);
  if (noProxy) {
    setProxies(env, { noProxy });
  }
  return env;
}

/**
 * pnpm's own env reader: the lowercase prefix, then the uppercase one, with an
 * empty value counting as undeclared. The uppercase spelling only arrived in
 * 11.0.6 (measured: 11.0.5 reads pnpm_config_registry and ignores
 * PNPM_CONFIG_REGISTRY, 11.0.6 reads both).
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
 * The TLS and proxy settings pnpm >= 11 takes from its own `PNPM_CONFIG_*`
 * prefix. They outrank pnpm-workspace.yaml (measured on 11.9.0 in both
 * directions for each key), so they are applied after it. `cafile` is left out
 * on purpose: pnpm accepts it and then never uses it for the fetch, the same
 * dead config as the yaml key.
 */
function applyEnvNetworkSettings(env: NpmConfigEnv, pnpmVersion: string): void {
  const strictSsl = readPnpmEnvVar('strict_ssl', pnpmVersion);
  if (strictSsl !== undefined) {
    // parseField types this setting Boolean, so only an explicit 'false' turns
    // verification off; every other value leaves it on.
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
 * the files. Every pair below was measured on 11.9.0 in both directions.
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
  if (fromFiles === 'unreadable') {
    // The layer that would have won is unreadable, so the `noproxy` spelling
    // below it cannot be applied either: it only wins when no `no-proxy` exists.
    return undefined;
  }
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
    // reproduce. Propagate to the caller's fall-open rather than continuing as
    // though the workspace declared no registry, which is what an unreadable
    // file most often hides.
    throw new Error(`The pnpm workspace file at ${path} could not be read.`);
  }
  return doc as PnpmWorkspaceSettings;
}

function getAuthIniPath(): string {
  return join(getPnpmConfigDir(process.env), 'auth.ini');
}

function bridgeAuthIni(
  env: NpmConfigEnv,
  root: string,
  scope: string | null,
  authIniPath: string,
  pnpmVersion: string,
  managerIgnoresEnv: boolean
): void {
  const authIni = readNpmrcMap(authIniPath);
  if (!authIni) {
    return;
  }
  // parseField decides a Boolean-typed setting from the literal value, before it
  // expands any `${VAR}`, so strict-ssl has to be read pre-expansion.
  const rawStrictSsl = authIni.get('strict-ssl');
  // pnpm's @pnpm/npm-conf runs envReplace on every auth.ini value. npm expands
  // env-tier values too, but only with its own grammar, so expand here to get
  // pnpm's (`${VAR:-default}` resolves, `${VAR?}` does not).
  for (const [key, value] of authIni) {
    authIni.set(key, expandPnpmEnvVars(value));
  }
  const projectNpmrc = readNpmrcMap(join(root, '.npmrc')) ?? new Map();
  // An empty value declares nothing: pnpm's own readers re-check for an empty
  // registry, and npm skips an empty env value outright. Deriving from one is
  // what does damage (an empty cafile resolves to auth.ini's own directory).
  const declared = (key: string): string | undefined =>
    authIni.get(key) || undefined;

  const authIniRegistry = declared('registry');
  // A registry already injected from the yaml/env (env has the key set) or
  // defined in the workspace .npmrc keeps winning, matching pnpm's layer order.
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
    if (!key.startsWith('//') || projectNpmrc.has(key)) {
      continue;
    }
    // A tokenHelper names a command to run for the token. npm has no such
    // setting and pnpm skips the key when it arrives through the environment,
    // so passing it on would put a command line in the child's environment that
    // neither tool ever reads. pnpm runs a helper only out of its user auth
    // file, and refuses to run at all when one reaches it from anywhere else,
    // so a helper here does not stand for a credential the fetch would have had.
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
      if (
        env[`npm_config_${dartKey}`] === undefined &&
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
    // expands a leading `~` (verified on 11.9.0: `~/ca.pem` reads
    // <config dir>/~/ca.pem). npm ignores a cafile it cannot open, so getting
    // the base wrong drops the trust anchor with no diagnostic at all.
    const base = gte(pnpmVersion, '11.2.0') ? dirname(authIniPath) : root;
    setCafile(env, resolve(base, cafile));
  }
  // Inline `ca` PEM material: npm reads it only as a flat (global) key, and pnpm
  // deliberately does not source-scope trust anchors, so it needs no pin check.
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
 * The proxy-bypass list is the one npmrc key whose spelling differs. Measured
 * against a logging proxy: pnpm 11 honors `no-proxy` and ignores `noproxy`,
 * where npm does the exact opposite (it warns about `no-proxy` as an unknown
 * config and moves on). pnpm 10.x honors both, so only the spelling npm cannot
 * read needs bridging on either line. Either way pnpm's `no-proxy` never
 * reaches the spawned npm from any file, the workspace .npmrc included, and the
 * layer that wins in pnpm has to be re-spelled. A `noProxy` in
 * pnpm-workspace.yaml outranks both files and is applied after this.
 */
function bridgeNoProxy(
  env: NpmConfigEnv,
  root: string,
  authIniPath?: string
): void {
  const value = fileNoProxy(root, authIniPath);
  if (value && value !== 'unreadable') {
    setProxies(env, { noProxy: value });
  }
}

/**
 * The `no-proxy` the npmrc-family files declare, or 'unreadable' when the layer
 * that would have won cannot be read.
 */
function fileNoProxy(
  root: string,
  authIniPath?: string
): string | 'unreadable' | undefined {
  const npmrcPath = join(root, '.npmrc');
  const projectNpmrc = readNpmrcMap(npmrcPath);
  // With the higher layer unreadable there is no telling which one wins, and
  // bridging auth.ini's value could reinstate a list the workspace clears.
  if (!projectNpmrc && existsSync(npmrcPath)) {
    return 'unreadable';
  }
  // The workspace .npmrc outranks auth.ini, and declaring the key empty there
  // is pnpm's way of clearing an inherited bypass list.
  const value = projectNpmrc?.has('no-proxy')
    ? projectNpmrc.get('no-proxy')
    : authIniPath && readNpmrcMap(authIniPath)?.get('no-proxy');
  // npm ignores `no-proxy` in the file it does read, so the value never goes
  // through npm's own expansion under that key; expand it with pnpm's grammar
  // (`${VAR:-default}` resolves, `${VAR?}` does not).
  return value ? expandPnpmEnvVars(value) : undefined;
}

/**
 * The registry the spawned npm will contact, as far as this process can see, in
 * npm's own precedence: the registry bridged into the env overlay, else one
 * already in the environment, else the one the workspace .npmrc declares, else
 * npm's default. npm reads the last two itself, so their values are expanded
 * with npm's grammar rather than pnpm's. A registry declared only in a
 * user-level ~/.npmrc is not visible here, which leaves the comparison covering
 * the sources that can redirect the request to a host the user never
 * configured.
 */
function contactedRegistry(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  scope: string | null,
  managerIgnoresEnv: boolean
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

/** The value npm resolves for `key`, as far as this process can see. */
function npmResolved(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  key: string,
  managerIgnoresEnv: boolean
): string | undefined {
  // npm's env tier outranks the .npmrc, but a spawn that strips the ambient
  // npm_config_* (mergeNpmConfigEnv when the manager ignores it) leaves npm only
  // the overlay and the file, so an ambient value the manager never saw is not
  // counted here either.
  const ambient = managerIgnoresEnv
    ? undefined
    : readNpmConfigEnv(process.env, key);
  const declared =
    env[`npm_config_${key}`] ??
    ambient ??
    // npm expands `${VAR}` in an .npmrc key before it looks a value up under it,
    // so a value keyed on `//${HOST}/` is found under the resolved dart.
    readExpandedKey(projectNpmrc, key, expandNpmEnvVars);
  // npm trims a value before it expands one (parseField), so a blank value
  // collapses while a padded reference still resolves.
  return declared === undefined ? undefined : expandNpmEnvVars(declared.trim());
}

/**
 * Whether npm finds credentials for `dart`, following its own lookup: a token,
 * an ident, or a complete user/password or client-certificate pair, at the dart
 * or at any parent of it (npm-registry-fetch regFromURI/hasAuth).
 */
function hasCredentials(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  dart: string,
  managerIgnoresEnv: boolean
): boolean {
  return hasCredentialFor(dart, (key) =>
    npmResolved(env, projectNpmrc, key, managerIgnoresEnv)
  );
}

/** pnpm reads a leading `~` on every platform; npm only takes `~\` on Windows. */
const PNPM_HOME_PATH = /^~[/\\]/;
const NPM_HOME_PATH = process.platform === 'win32' ? /^~[/\\]/ : /^~\//;

/** Both tools normalize a config path this way: a leading `~` for the home
 *  directory, else resolved against the cwd the command runs in. That cwd is the
 *  config root the spawn uses, not this process's cwd (which a migrate from a
 *  workspace subdirectory would differ from). An absolute value is unaffected. */
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
  managerIgnoresEnv: boolean
): void {
  const userConfig = userConfigPath ? readNpmrcMap(userConfigPath) : null;
  if (!userConfig) {
    return;
  }
  const projectNpmrc = readNpmrcMap(join(root, '.npmrc')) ?? new Map();
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
    // npm expands `${VAR}` in this file's keys too, so match the resolved dart.
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
 * Whether the credential pnpm would present at `dart` comes from a token
 * helper: one keyed on that registry or a parent of it, or the unscoped one
 * `pinnedDart` says pnpm aims there. A helper outranks every other credential
 * for that registry, whichever layer those came from (credsToHeader), so it is
 * what pnpm sends.
 */
function declaresTokenHelper(
  userConfig: Map<string, string>,
  dart: string,
  pinnedDart: string | null
): boolean {
  // pnpm expands `${VAR}` in this file, in a key before it reads the value under
  // it (so `//${HOST}/:tokenHelper` is found under the resolved dart) and in the
  // value (a reference resolving to nothing declares no helper at all).
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
 * Network settings pnpm honors from pnpm-workspace.yaml. `strictSsl` is
 * verified applied from the yaml (10.16 and 11.5); `caFile`/`cafile` in the
 * YAML is dead config in pnpm itself (it loads CA material from the
 * npmrc-family files only: .npmrc, which npm reads natively, and auth.ini,
 * bridged in bridgeAuthIni), so the YAML key is deliberately not bridged.
 * Proxy keys follow the same yaml surface (source-verified).
 *
 * `applyNoProxy` is off where a caller resolves the bypass list across more
 * layers than the yaml itself.
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
    // pnpm honors either spelling and prefers noProxy when both are set
    // (verified on 11.2.2 and 11.9.0: with noProxy naming another host, a
    // noproxy bypass for the registry stops applying).
    noProxy: applyNoProxy ? (settings.noProxy ?? settings.noproxy) : undefined,
  });
}
