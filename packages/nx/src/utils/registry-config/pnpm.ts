import { homedir } from 'os';
import { join, resolve } from 'path';
import { gte, lt } from 'semver';
import {
  getPnpmConfigDir,
  readPnpmYamlConfig,
} from '../package-manager-config/pnpm-config';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import {
  expandEnvVars,
  getPackageScope,
  nerfDart,
  setCafile,
  setProxies,
  setRegistry,
  setScopedRegistry,
  setStrictSsl,
  type NpmConfigEnv,
} from './utils';

// pnpm's @pnpm/npm-conf parseField resolves a path setting against the cwd (the
// workspace root), expanding a leading `~/` (and `~\` only on Windows) against
// the home dir first. pnpm seeds its HOME from os.homedir() before resolving,
// so use that (os.homedir()) rather than a possibly-unset process.env.HOME.
function resolvePnpmPath(value: string, root: string): string {
  const home = homedir();
  const tilde =
    process.platform === 'win32'
      ? value.startsWith('~/') || value.startsWith('~\\')
      : value.startsWith('~/');
  if (tilde && home) {
    return resolve(home, value.slice(2));
  }
  return resolve(root, value);
}

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
    // Wholesale semantics: any applicable registries entry beats every other
    // surface, so force both the default and the scoped key to the yaml pick.
    // A scoped-only map with an unscoped target crashes pnpm itself (the
    // replace wipes registries.default), so there is no behavior to mimic and
    // npm's own resolution is left in place.
    const pick =
      (scope ? settings.registries?.[scope] : undefined) ??
      settings.registries?.default;
    if (pick) {
      setRegistry(env, pick);
      if (scope) {
        setScopedRegistry(env, scope, pick);
      }
    }
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
  // pnpm only honors the uppercase PNPM_CONFIG_* env prefix from 11.1.0.
  const envRegistry =
    process.env['pnpm_config_registry'] ??
    (gte(pnpmVersion, '11.1.0')
      ? process.env['PNPM_CONFIG_REGISTRY']
      : undefined);
  const defaultRegistry = envRegistry ?? settings.registries?.default;
  if (defaultRegistry) {
    setRegistry(env, defaultRegistry);
  }

  bridgeAuthIni(env, root, scope);

  applyYamlNetworkSettings(env, settings);
  return env;
}

function readPnpmWorkspaceSettings(root: string): PnpmWorkspaceSettings {
  const doc = readPnpmYamlConfig(join(root, 'pnpm-workspace.yaml'));
  // An unparseable file would abort pnpm itself; skip the surface here.
  if (doc === null || doc === 'invalid') {
    return {};
  }
  return doc as PnpmWorkspaceSettings;
}

/**
 * pnpm >= 11 layers `auth.ini` (written by `pnpm config set` for registry, auth,
 * and TLS/proxy keys) between the user and the workspace .npmrc. npm never reads
 * it, so its keys are injected at the env tier, guarded so a workspace .npmrc
 * that defines the same key keeps winning (matching pnpm's layer order).
 */
function bridgeAuthIni(
  env: NpmConfigEnv,
  root: string,
  scope: string | null
): void {
  const configDir = getPnpmConfigDir(process.env);
  const authIni = readNpmrcMap(join(configDir, 'auth.ini'));
  if (!authIni) {
    return;
  }
  // parseField decides a Boolean-typed setting from the literal value, before it
  // expands any `${VAR}`, so strict-ssl has to be read pre-expansion.
  const rawStrictSsl = authIni.get('strict-ssl');
  // pnpm's @pnpm/npm-conf runs envReplace on every auth.ini value; a spawned npm
  // does not expand env-sourced config, so expand `${VAR}` references here before
  // bridging (e.g. `//host/:_authToken=${NPM_TOKEN}` must carry the real token).
  for (const [key, value] of authIni) {
    authIni.set(key, expandEnvVars(value));
  }
  const projectNpmrc = readNpmrcMap(join(root, '.npmrc')) ?? new Map();

  // A registry already injected from the yaml/env (env has the key set) or
  // defined in the workspace .npmrc keeps winning, matching pnpm's layer order.
  if (
    !env['npm_config_registry'] &&
    !projectNpmrc.has('registry') &&
    authIni.has('registry')
  ) {
    setRegistry(env, authIni.get('registry'));
  }
  if (
    scope &&
    !env[`npm_config_${scope}:registry`] &&
    !projectNpmrc.has(`${scope}:registry`) &&
    authIni.has(`${scope}:registry`)
  ) {
    setScopedRegistry(env, scope, authIni.get(`${scope}:registry`));
  }
  // Nerf-darted auth/TLS keys (e.g. //host/:_authToken) from auth.ini.
  for (const [key, value] of authIni) {
    if (key.startsWith('//') && !projectNpmrc.has(key)) {
      env[`npm_config_${key}`] = value;
    }
  }

  // pnpm's getDefaultCreds applies a bare global _auth/_authToken/username/
  // _password (no nerf-dart prefix) to the default registry; npm honors auth only
  // in the nerf-darted form, so re-key it onto that registry's dart. The target
  // must follow the registry pnpm resolves, including one declared in the
  // workspace .npmrc, which is left for npm to read natively and therefore is not
  // in env: aiming at npmjs there would send a private credential to the public
  // registry. A workspace .npmrc bare key is not a source here; npm reads that
  // file itself and rejects bare auth in it (ERR_INVALID_AUTH).
  const projectRegistry = projectNpmrc.get('registry');
  const defaultRegistryDart = nerfDart(
    env['npm_config_registry'] ??
      (projectRegistry !== undefined
        ? expandEnvVars(projectRegistry)
        : 'https://registry.npmjs.org/')
  );
  if (defaultRegistryDart) {
    for (const bareKey of [
      '_authToken',
      '_auth',
      'username',
      '_password',
    ] as const) {
      const raw = authIni.get(bareKey);
      const dartKey = `npm_config_${defaultRegistryDart}:${bareKey}`;
      if (raw !== undefined && env[dartKey] === undefined) {
        env[dartKey] = raw;
      }
    }
  }

  // Flat TLS/proxy keys are part of pnpm's auth-config inheritance set
  // (RAW_AUTH_CFG_KEYS) and are written to auth.ini by `pnpm config set`, so
  // bridge them too (a workspace .npmrc that sets the same key still wins).
  const unbridged = (key: string): boolean =>
    !projectNpmrc.has(key) && authIni.has(key);
  if (unbridged('cafile')) {
    // pnpm resolves a relative cafile against its cwd (the workspace root) and
    // expands a leading ~/ against $HOME (@pnpm/npm-conf parseField).
    setCafile(env, resolvePnpmPath(authIni.get('cafile'), root));
  }
  // Inline `ca`/`cert`/`key` PEM material: npm reads these only as flat (global)
  // keys. Its registry-scoped TLS keys are the file-path forms
  // (//host/:certfile / :keyfile), which can't carry inline PEM, so bridge them
  // flat, the same shape pnpm applies them in.
  for (const key of ['ca', 'cert', 'key'] as const) {
    if (unbridged(key)) {
      env[`npm_config_${key}`] = authIni.get(key);
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
    noProxy: unbridged('no-proxy') ? authIni.get('no-proxy') : undefined,
  });
}

/**
 * Network settings pnpm honors from pnpm-workspace.yaml. `strictSsl` is
 * verified applied from the yaml (10.16 and 11.5); `caFile`/`cafile` in the
 * YAML is dead config in pnpm itself (it loads CA material from the
 * npmrc-family files only: .npmrc, which npm reads natively, and auth.ini,
 * bridged in bridgeAuthIni), so the YAML key is deliberately not bridged.
 * Proxy keys follow the same yaml surface (source-verified; not empirically
 * testable in the sandbox).
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
