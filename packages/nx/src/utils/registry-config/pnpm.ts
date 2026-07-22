import { existsSync } from 'fs';
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
  nerfDart,
  readNpmConfigEnv,
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
 *   config dir layers between the user and workspace .npmrc.
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
}

export function getPnpmSpawnRegistryEnv(
  packageName: string,
  root: string,
  pnpmVersion: string | null
): NpmConfigEnv {
  const env: NpmConfigEnv = {};
  // Without a version we cannot reason about which surfaces this pnpm honors;
  // leave npm's own resolution untouched (the pre-existing behavior).
  if (!pnpmVersion || lt(pnpmVersion, '10.6.0')) {
    return env;
  }

  const settings = readPnpmWorkspaceSettings(root);
  const scope = getPackageScope(packageName);

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
  // pnpm only honors the uppercase PNPM_CONFIG_* env prefix from 11.0.6.
  const envRegistry =
    process.env['pnpm_config_registry'] ??
    (gte(pnpmVersion, '11.0.6')
      ? process.env['PNPM_CONFIG_REGISTRY']
      : undefined);
  const defaultRegistry = envRegistry ?? settings.registries?.default;
  if (defaultRegistry) {
    setRegistry(env, defaultRegistry);
  }

  const authIniPath = getAuthIniPath();
  bridgeAuthIni(env, root, scope, authIniPath, pnpmVersion);
  bridgeNoProxy(env, root, authIniPath);

  applyYamlNetworkSettings(env, settings);
  return env;
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

/**
 * pnpm >= 11 layers `auth.ini` (written by `pnpm config set` for registry, auth,
 * and TLS/proxy keys) between the user and the workspace .npmrc. npm never reads
 * it, so its keys are injected at the env tier, guarded so a workspace .npmrc
 * that defines the same key keeps winning (matching pnpm's layer order).
 */
function getAuthIniPath(): string {
  return join(getPnpmConfigDir(process.env), 'auth.ini');
}

function bridgeAuthIni(
  env: NpmConfigEnv,
  root: string,
  scope: string | null,
  authIniPath: string,
  pnpmVersion: string
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
    if (key.startsWith('//') && !projectNpmrc.has(key)) {
      env[`npm_config_${key}`] = value;
    }
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

  const contacted = contactedRegistry(env, projectNpmrc, scope);
  const contactedDart = nerfDart(contacted);
  // A withheld credential is invisible in npm's own error, so name it, unless
  // npm already finds one for that registry among the sources visible here. A
  // user-level ~/.npmrc is not one, so the message states only what was
  // withheld rather than predicting how the request will fail.
  if (
    bareKeys.length > 0 &&
    contactedDart &&
    credentialDart !== contactedDart &&
    !hasCredentials(env, projectNpmrc, contactedDart)
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
  const npmrcPath = join(root, '.npmrc');
  const projectNpmrc = readNpmrcMap(npmrcPath);
  // With the higher layer unreadable there is no telling which one wins, and
  // bridging auth.ini's value could reinstate a list the workspace clears.
  if (!projectNpmrc && existsSync(npmrcPath)) {
    return;
  }
  // The workspace .npmrc outranks auth.ini, and declaring the key empty there
  // is pnpm's way of clearing an inherited bypass list.
  const value = projectNpmrc?.has('no-proxy')
    ? projectNpmrc.get('no-proxy')
    : authIniPath && readNpmrcMap(authIniPath)?.get('no-proxy');
  if (value) {
    // npm ignores `no-proxy` in the file it does read, so the value never goes
    // through npm's own expansion under that key; expand it with pnpm's grammar
    // (`${VAR:-default}` resolves, `${VAR?}` does not).
    setProxies(env, { noProxy: expandPnpmEnvVars(value) });
  }
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
  scope: string | null
): string {
  // npm's pickRegistry falls through on a falsy value, so a setting that
  // expanded to nothing lands on the next one rather than on an empty host.
  return (
    (scope ? npmResolved(env, projectNpmrc, `${scope}:registry`) : undefined) ||
    npmResolved(env, projectNpmrc, 'registry') ||
    DEFAULT_REGISTRY
  );
}

/** The value npm resolves for `key`, as far as this process can see. */
function npmResolved(
  env: NpmConfigEnv,
  projectNpmrc: Map<string, string>,
  key: string
): string | undefined {
  // An ambient npm_config_* survives only where the overlay claims nothing
  // (mergeNpmConfigEnv drops it otherwise), and it still outranks the .npmrc.
  const declared =
    env[`npm_config_${key}`] ??
    readNpmConfigEnv(process.env, key) ??
    projectNpmrc.get(key);
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
  dart: string
): boolean {
  return hasCredentialFor(dart, (key) => npmResolved(env, projectNpmrc, key));
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
 */
function applyYamlNetworkSettings(
  env: NpmConfigEnv,
  settings: PnpmWorkspaceSettings
): void {
  if (typeof settings.strictSsl === 'boolean') {
    setStrictSsl(env, settings.strictSsl);
  }
  setProxies(env, {
    httpProxy: settings.proxy,
    httpsProxy: settings.httpsProxy,
    noProxy: settings.noProxy,
  });
}
