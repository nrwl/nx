import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import {
  ancestorDirectories,
  getPackageScope,
  readEnvVar,
  setCafile,
  setProxies,
  setRegistry,
  setScopedRegistry,
  setStrictSsl,
  type NpmConfigEnv,
} from './utils';

/*
 * yarn classic (1.x) registry resolution (verified on 1.22.22):
 *
 * Config files, highest precedence first (yarn merges them earlier-wins):
 *   project .{npmrc,yarnrc} > home .{npmrc,yarnrc} > <globalPrefix>/etc/{npmrc,
 *   yarnrc} > ancestor .{npmrc,yarnrc} walking up to the filesystem root.
 *   `home` is os.homedir(), except as root (uid 0, no FAKEROOTKEY) where yarn
 *   reads /usr/local/share first and the real home second. <globalPrefix> is
 *   $PREFIX, else dirname(dirname(process.execPath)) (dirname on Windows).
 *
 * Unscoped registry: a `--registry`/`--install.registry` line in any .yarnrc
 * (yarn injects it as a default CLI arg) > npm_config_registry env >
 * YARN_REGISTRY env > .npmrc registry (the npm-config chain is exhausted first)
 * > .yarnrc registry > https://registry.yarnpkg.com.
 *
 * Scoped: @scope:registry in npm config (env/.npmrc) > @scope:registry in
 * .yarnrc > the unscoped chain.
 *
 * Option keys (cafile, strict-ssl, proxy) resolve the other way around: yarn
 * config (.yarnrc) first, then npm config. `strict-ssl` is Boolean()-coerced,
 * so only a bare `false` (yaml/lockfile boolean) disables TLS; a quoted
 * `"false"` stays the truthy string 'false' and keeps verification on. A
 * `cafile` value is tilde-expanded (`~/`) then resolved against the cwd.
 *
 * npm natively reads the project, home, and <globalPrefix>/etc .npmrc plus env
 * vars identically, so bridging is only needed when a yarn-only surface wins
 * (YARN_REGISTRY, any .yarnrc, ancestor .npmrc, the root /usr/local/share home,
 * or a CLI `--registry` line).
 *
 * See https://github.com/yarnpkg/yarn/blob/740c38c3a962c30ddb344a919bbfb7065620714b/src/registries/npm-registry.js#L345-L436
 */

export const YARN_CLASSIC_DEFAULT_REGISTRY = 'https://registry.yarnpkg.com';

// A parsed .yarnrc value mirrors yarn's lockfile tokenizer: a bare `true`/
// `false` is a boolean, a bare integer is a number, and everything else
// (quoted, or a bare word/URL) is a string.
type YarnValue = string | number | boolean;

interface RcFile {
  // npm reads the project, home, and <globalPrefix>/etc .npmrc natively; any
  // other file (ancestors, the root /usr/local/share home, every .yarnrc) is
  // invisible to npm and must be bridged when it wins.
  npmNative: boolean;
  map: Map<string, YarnValue> | null;
}

export function getYarnClassicSpawnRegistryEnv(
  packageName: string,
  root: string
): NpmConfigEnv {
  const env: NpmConfigEnv = {};
  const scope = getPackageScope(packageName);
  const realHome = homedir();
  const { primary, secondary } = yarnHomeTiers(realHome);

  // [project, primary home, etc, (root secondary home), ...ancestors]. yarn
  // ranks <prefix>/etc above the real home it adds under root, so the secondary
  // home tier follows etc. The etc tier uses dotless `npmrc`/`yarnrc` names.
  const sources: {
    npmrcPath: string;
    yarnrcPath: string;
    npmNative: boolean;
  }[] = [
    dotfiles(root, true),
    dotfiles(primary.dir, primary.npmNative),
    {
      npmrcPath: join(globalEtcDir(), 'npmrc'),
      yarnrcPath: join(globalEtcDir(), 'yarnrc'),
      npmNative: true,
    },
    ...(secondary ? [dotfiles(secondary.dir, secondary.npmNative)] : []),
    ...ancestorDirectories(root).map((dir) => dotfiles(dir, false)),
  ];
  const npmrcChain: RcFile[] = sources.map((s) => ({
    npmNative: s.npmNative,
    map: toYarnValueMap(readNpmrcMap(s.npmrcPath)),
  }));
  const yarnrcChain: RcFile[] = sources.map((s) => ({
    // npm never reads .yarnrc, so every entry is a yarn-only surface.
    npmNative: false,
    map: readYarnrcMap(s.yarnrcPath),
  }));
  // `--registry`/`--install.registry` CLI default args resolve through yarn's
  // separate rc path set, merged last-wins, so ~/.yarnrc beats the project
  // .yarnrc which beats ancestors. <prefix>/etc, system /etc and XDG
  // ~/.config/yarn lines live at paths this set does not cover and are skipped.
  const cliRegistryChain: RcFile[] = [
    { npmNative: false, map: readYarnrcMap(join(realHome, '.yarnrc')) },
    { npmNative: false, map: readYarnrcMap(join(root, '.yarnrc')) },
    ...ancestorDirectories(root).map((dir) => ({
      npmNative: false,
      map: readYarnrcMap(join(dir, '.yarnrc')),
    })),
  ];

  resolveRegistry(env, npmrcChain, yarnrcChain, cliRegistryChain, scope);
  // yarn tilde-expands paths against userHomeDir.default (the primary home).
  resolveOptions(env, npmrcChain, yarnrcChain, root, primary.dir);
  resolveAuth(env, npmrcChain);
  return env;
}

// yarn reads registry auth only from the .npmrc chain (never .yarnrc), keyed by
// the registry-URL nerf-dart, with the same project > home > etc > ancestors
// precedence. npm reads the native files itself, so any auth whose winning
// entry is a yarn-only file is bridged - otherwise the spawned npm would hit a
// bridged ancestor registry unauthenticated.
function resolveAuth(env: NpmConfigEnv, npmrcChain: RcFile[]): void {
  const authKeys = new Set<string>();
  for (const file of npmrcChain) {
    if (!file.map) {
      continue;
    }
    for (const key of file.map.keys()) {
      if (isAuthKey(key)) {
        authKeys.add(key);
      }
    }
  }
  for (const key of authKeys) {
    const winner = firstString(npmrcChain, key);
    // _password/_authToken/_auth values are stored (and consumed by npm) in the
    // same encoding yarn reads them, so they bridge verbatim.
    if (winner && !winner.npmNative) {
      env[`npm_config_${key}`] = winner.value;
    }
  }
}

const BARE_AUTH_KEYS = new Set([
  '_authToken',
  '_auth',
  'username',
  '_password',
]);

function isAuthKey(key: string): boolean {
  if (key.startsWith('//')) {
    return /:(?:_authToken|_auth|username|_password)$/i.test(key);
  }
  return BARE_AUTH_KEYS.has(key);
}

function resolveRegistry(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  cliYarnrcChain: RcFile[],
  scope: string | null
): void {
  if (scope) {
    resolveScopedRegistry(env, npmrcChain, yarnrcChain, scope);
  }

  // 1. A `--registry`/`--install.registry` line in a CLI-rc .yarnrc lands at
  // yarn's CLI tier, above npm_config_registry env, so it always needs bridging.
  const cliRegistry =
    firstString(cliYarnrcChain, '--install.registry') ??
    firstString(cliYarnrcChain, '--registry');
  if (cliRegistry) {
    setRegistry(env, cliRegistry.value);
    return;
  }
  // 2. npm_config_registry env: npm resolves it natively.
  if (readEnvVar(process.env, 'npm_config_registry') !== undefined) {
    return;
  }
  // 3. YARN_REGISTRY env (yarn-only).
  const yarnRegistryEnv = readEnvVar(process.env, 'YARN_REGISTRY');
  if (yarnRegistryEnv !== undefined) {
    setRegistry(env, yarnRegistryEnv);
    return;
  }
  // 4. The .npmrc chain is exhausted before .yarnrc is consulted.
  const npmrcRegistry = firstString(npmrcChain, 'registry');
  if (npmrcRegistry) {
    if (!npmrcRegistry.npmNative) {
      setRegistry(env, npmrcRegistry.value);
    }
    return;
  }
  // 5. .yarnrc registry (every entry yarn-only). The yarn default is npmjs'
  // CNAME; leaving npm on registry.npmjs.org keeps nerf-darted auth working.
  const yarnrcRegistry = firstString(yarnrcChain, 'registry');
  if (
    yarnrcRegistry &&
    yarnrcRegistry.value.replace(/\/$/, '') !== YARN_CLASSIC_DEFAULT_REGISTRY
  ) {
    setRegistry(env, yarnrcRegistry.value);
  }
}

function resolveScopedRegistry(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  scope: string
): void {
  const scopedKey = `${scope}:registry`;
  // npm config (env + .npmrc) wins over .yarnrc for scoped keys.
  if (process.env[`npm_config_${scopedKey}`] !== undefined) {
    return;
  }
  const npmScoped = firstString(npmrcChain, scopedKey);
  if (npmScoped) {
    if (!npmScoped.npmNative) {
      setScopedRegistry(env, scope, npmScoped.value);
    }
    return;
  }
  const yarnScoped = firstString(yarnrcChain, scopedKey);
  if (yarnScoped) {
    setScopedRegistry(env, scope, yarnScoped.value);
  }
}

function resolveOptions(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  root: string,
  home: string
): void {
  // Option keys resolve .yarnrc first, then the full .npmrc chain. npm reads
  // its native .npmrc entries on its own, so a value is bridged only when the
  // winner is a .yarnrc entry or a yarn-only .npmrc entry.
  const cafile = resolveOption(firstString, npmrcChain, yarnrcChain, 'cafile');
  if (cafile) {
    setCafile(env, resolveYarnPath(cafile, root, home));
  }

  // strict-ssl is Boolean()-coerced by yarn; only a falsy value disables TLS.
  const strictSsl = resolveOption(
    firstDefined,
    npmrcChain,
    yarnrcChain,
    'strict-ssl'
  );
  if (strictSsl !== undefined && !truthyStrictSsl(strictSsl)) {
    setStrictSsl(env, false);
  }

  setProxies(env, {
    httpProxy: resolveOption(firstString, npmrcChain, yarnrcChain, 'proxy'),
    httpsProxy: resolveOption(
      firstString,
      npmrcChain,
      yarnrcChain,
      'https-proxy'
    ),
  });
}

// Resolves an option key the way yarn does (.yarnrc wins over .npmrc), and
// returns the value to bridge: the .yarnrc value when present, otherwise the
// first .npmrc value but only if npm cannot read it natively.
function resolveOption<T extends YarnValue>(
  lookup: (chain: RcFile[], key: string) => Match<T> | undefined,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  key: string
): T | undefined {
  const yarnrc = lookup(yarnrcChain, key);
  if (yarnrc) {
    return yarnrc.value;
  }
  const npmrc = lookup(npmrcChain, key);
  return npmrc && !npmrc.npmNative ? npmrc.value : undefined;
}

function dotfiles(
  dir: string,
  npmNative: boolean
): { npmrcPath: string; yarnrcPath: string; npmNative: boolean } {
  return {
    npmrcPath: join(dir, '.npmrc'),
    yarnrcPath: join(dir, '.yarnrc'),
    npmNative,
  };
}

interface HomeTier {
  dir: string;
  npmNative: boolean;
}

// yarn's userHomeDir.default is /usr/local/share when running as root (uid 0,
// no FAKEROOTKEY) and the real home otherwise; under root yarn ALSO reads the
// real home as a secondary tier (ranked below <prefix>/etc). The primary is the
// tilde-expansion base. npm reads only the real home natively (its userconfig),
// so /usr/local/share is npm-invisible.
function yarnHomeTiers(home: string): {
  primary: HomeTier;
  secondary?: HomeTier;
} {
  const isRoot =
    process.platform !== 'win32' &&
    typeof process.getuid === 'function' &&
    process.getuid() === 0 &&
    !process.env.FAKEROOTKEY;
  if (isRoot) {
    return {
      primary: { dir: '/usr/local/share', npmNative: false },
      secondary: { dir: home, npmNative: true },
    };
  }
  return { primary: { dir: home, npmNative: true } };
}

// yarn's getGlobalPrefix: $PREFIX, else the directory two levels above the node
// binary (one level on Windows). Hosts the etc/{npmrc,yarnrc} files.
function globalEtcDir(): string {
  const prefix =
    process.env.PREFIX ??
    (process.platform === 'win32'
      ? dirname(process.execPath)
      : dirname(dirname(process.execPath)));
  return join(prefix, 'etc');
}

interface Match<T extends YarnValue> {
  value: T;
  npmNative: boolean;
}

function firstDefined(
  chain: RcFile[],
  key: string
): Match<YarnValue> | undefined {
  for (const file of chain) {
    const value = file.map?.get(key);
    if (value !== undefined) {
      return { value, npmNative: file.npmNative };
    }
  }
  return undefined;
}

// String-typed lookup: yarn stores a bare `false`/number as a non-string, which
// is never a valid registry/path/proxy value, so skip those entries.
function firstString(chain: RcFile[], key: string): Match<string> | undefined {
  for (const file of chain) {
    const value = file.map?.get(key);
    if (typeof value === 'string') {
      return { value, npmNative: file.npmNative };
    }
  }
  return undefined;
}

// yarn computes strictSSL = Boolean(getOption('strict-ssl')); the string
// 'false' (a quoted value) is truthy, only a bare boolean false / 0 / '' isn't.
function truthyStrictSsl(value: YarnValue): boolean {
  return Boolean(value);
}

// yarn expands a leading `~/` to the home dir, then path.resolve()s against the
// cwd (the workspace root). Resolve to an absolute path since the spawned npm
// may run from a temp dir.
function resolveYarnPath(value: string, root: string, home: string): string {
  if (value === '~') {
    return home;
  }
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return resolve(home, value.slice(2));
  }
  return resolve(root, value);
}

function toYarnValueMap(
  map: Map<string, string> | null
): Map<string, YarnValue> | null {
  if (!map) {
    return null;
  }
  // npm's ini parser yields strings; coerce the booleans npm itself recognizes
  // so option semantics line up with the .yarnrc side.
  const result = new Map<string, YarnValue>();
  for (const [key, value] of map) {
    result.set(
      key,
      value === 'true' ? true : value === 'false' ? false : value
    );
  }
  return result;
}

/**
 * Parses yarn classic's .yarnrc (yarn-lockfile syntax: `key "value"` or
 * `"quoted key" "value"`, `#` comments, optional trailing comment) into a
 * last-write-wins map. A bare `true`/`false`/integer becomes a boolean/number,
 * matching yarn's tokenizer; quoted values stay strings. Returns null when the
 * file is missing or unreadable.
 */
function readYarnrcMap(path: string): Map<string, YarnValue> | null {
  if (!existsSync(path)) {
    return null;
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
  const map = new Map<string, YarnValue>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(
      /^(?:"([^"]+)"|([^\s"]+))\s+(?:"([^"]*)"|(\S+))\s*(?:#.*)?$/
    );
    if (!match) {
      continue;
    }
    const key = match[1] ?? match[2];
    // A quoted value (group 3) is always a string; a bare value (group 4) is
    // typed the way yarn's lockfile tokenizer types it.
    const value =
      match[3] !== undefined ? match[3] : parseBareYarnValue(match[4]);
    map.set(key, value);
  }
  return map;
}

function parseBareYarnValue(raw: string): YarnValue {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  if (/^-?\d+$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}
