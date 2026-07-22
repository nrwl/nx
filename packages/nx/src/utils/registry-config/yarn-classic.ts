import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import {
  ancestorDirectories,
  expandEnvVars,
  getPackageScope,
  nerfDart,
  readEnvVar,
  readNpmConfigEnv,
  setCafile,
  setProxies,
  setRegistry,
  setScopedRegistry,
  setStrictSsl,
  warnNativeCredential,
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
 * Option keys (cafile, strict-ssl, proxy) resolve the other way around, and off
 * the env first: `npm_config_<key>` > `yarn_<key>` > .yarnrc > npm config.
 * `strict-ssl` reaches yarn from the env and .yarnrc only, never from an .npmrc.
 * It is Boolean()-coerced, so only a bare `false` (yaml/lockfile boolean, or the
 * env string yarn coerces the same way) disables TLS; a quoted `"false"` in a
 * file stays the truthy string 'false' and keeps verification on. A `cafile`
 * value is tilde-expanded (`~/`) then resolved against the cwd. `always-auth` is
 * not one of these: it is read off the npm registry's own config (npmrc chain
 * plus the `yarn_`/`npm_config_` env prefixes), not .yarnrc, and for the
 * registry being queried rather than for the key the credential came from.
 *
 * npm natively reads the project, home, and <globalPrefix>/etc .npmrc plus env
 * vars identically, so bridging is only needed when a yarn-only surface wins
 * (YARN_REGISTRY, any .yarnrc, ancestor .npmrc, the root /usr/local/share home,
 * or a CLI `--registry` line).
 *
 * See https://github.com/yarnpkg/yarn/blob/740c38c3a962c30ddb344a919bbfb7065620714b/src/registries/npm-registry.js#L345-L436
 */

const YARN_CLASSIC_DEFAULT_REGISTRY = 'https://registry.yarnpkg.com';

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
  const ancestors = ancestorDirectories(root);
  const etcDir = globalEtcDir();

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
      npmrcPath: join(etcDir, 'npmrc'),
      yarnrcPath: join(etcDir, 'yarnrc'),
      npmNative: true,
    },
    ...(secondary ? [dotfiles(secondary.dir, secondary.npmNative)] : []),
    ...ancestors.map((dir) => dotfiles(dir, false)),
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
    ...ancestors.map((dir) => ({
      npmNative: false,
      map: readYarnrcMap(join(dir, '.yarnrc')),
    })),
  ];

  const authRegistry = resolveRegistry(
    env,
    npmrcChain,
    yarnrcChain,
    cliRegistryChain,
    scope
  );
  // yarn tilde-expands paths against userHomeDir.default (the primary home).
  resolveOptions(env, npmrcChain, yarnrcChain, root, primary.dir);
  resolveAuth(env, npmrcChain, scope, authRegistry);
  return env;
}

// yarn reads registry auth only from the .npmrc chain (never .yarnrc), with the
// same project > home > etc > ancestors precedence. Its getRegistryOrGlobalOption
// takes a registry-scoped (nerf-darted) key first, else the bare global key. It
// attaches that auth only on a scoped fetch, or on an unscoped one when
// always-auth is set for the registry (registry-scoped key, else global). npm
// reads the native files itself, so a yarn-only winner is bridged, but only when
// yarn would send it; bridging unconditionally would make npm authenticate where
// yarn stays anonymous and 401 on a registry that serves the package without
// credentials.
function resolveAuth(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  scope: string | null,
  authRegistry: string
): void {
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
  // npm honors auth only in the nerf-darted form, so a bare global key
  // (_authToken/_auth/username/_password) is re-keyed onto the registry yarn
  // would send it to, from any source: npm ignores a bare key even in its own
  // .npmrc, while yarn's getOption reads it from the whole chain. Values carry
  // over as-is: npm consumes the _auth/_password base64 the way yarn reads it.
  const dart = nerfDart(authRegistry);
  // yarn authenticates a scoped fetch unconditionally; an unscoped one only when
  // always-auth is set for the registry it is about to query, whichever key the
  // credential itself came from. Skip the bridge where yarn would send nothing.
  const authenticates = scope !== null || alwaysAuthFor(dart, npmrcChain);
  if (!authenticates && dart) {
    // The gate stops the bridge, not npm's own read of the same files, so say
    // so where npm is about to authenticate on a registry yarn resolved.
    warnNativeCredential(env, dart, 'yarn', (key) => {
      const match = firstString(npmrcChain, key);
      return (
        readNpmConfigEnv(process.env, key) ??
        (match?.npmNative ? match.value : undefined)
      );
    });
  }
  const bareBridges: { key: string; value: string }[] = [];
  for (const key of authKeys) {
    const winner = firstString(npmrcChain, key);
    if (!winner || !authenticates) {
      continue;
    }
    if (key.startsWith('//')) {
      // Already nerf-darted: npm reads the native ones itself.
      if (!winner.npmNative) {
        env[`npm_config_${key}`] = winner.value;
      }
    } else if (dart) {
      bareBridges.push({ key, value: winner.value });
    }
  }
  for (const { key, value } of bareBridges) {
    // yarn's getRegistryOrGlobalOption takes a registry-scoped key over the bare
    // global one, and npm reads a native scoped key itself, so a matching
    // nerf-darted key (from any tier) must not be shadowed by the bare value.
    if (firstString(npmrcChain, `${dart}:${key}`)) {
      continue;
    }
    env[`npm_config_${dart}:${key}`] = value;
  }
}

// yarn's getRegistryOrGlobalOption(registry, 'always-auth'): a registry-scoped
// `//host/:always-auth` for the registry being queried wins, else the global
// `always-auth`, then Boolean()-coerced. Both come from NpmRegistry's own
// config, which .yarnrc never feeds: loadConfig reads the npmrc chain only.
// Unlike resolveOption this returns the value regardless of whether npm reads it
// natively, since it drives the auth gate rather than a bridge.
function alwaysAuthFor(dart: string | null, npmrcChain: RcFile[]): boolean {
  const registryScoped = dart
    ? registryScopedAlwaysAuth(dart, npmrcChain)
    : undefined;
  // BaseRegistry.init merges the `yarn_` env prefix and loadConfig then merges
  // `npm_config_` over it, before any file is read; loadConfig's Object.assign
  // keeps the config it already has, so an env value beats every npmrc.
  const globalFromEnv =
    readEnvVar(process.env, 'npm_config_always_auth') ??
    readEnvVar(process.env, 'yarn_always_auth');
  const global =
    globalFromEnv !== undefined
      ? normalizeYarnConfigValue(globalFromEnv)
      : firstDefined(npmrcChain, 'always-auth')?.value;
  return Boolean(registryScoped || global);
}

// The registry-scoped tier of that lookup. mergeEnv lowercases an env key,
// rewrites `__` to `.` and `_` to `-`, then stores it with objectPath, which
// splits on `.` into nested objects, while every read is flat. So a
// registry-scoped env key reaches yarn's own read only when the whole key is
// dot-free, which for a fixed `:always-auth` suffix means the dart itself is
// (verified on 1.22.22: an env key for //localhost:PORT/ authenticates an
// unscoped fetch, the same key for //127.0.0.1:PORT/ does not). Consulting one
// that yarn cannot see would authenticate where yarn sends nothing.
function registryScopedAlwaysAuth(
  dart: string,
  npmrcChain: RcFile[]
): YarnValue | undefined {
  if (!dart.includes('.')) {
    const fromEnv =
      readEnvVar(process.env, `npm_config_${dart}:always-auth`) ??
      readEnvVar(process.env, `yarn_${dart}:always-auth`);
    if (fromEnv !== undefined) {
      return normalizeYarnConfigValue(fromEnv);
    }
  }
  return firstDefined(npmrcChain, `${dart}:always-auth`)?.value;
}

/** yarn's BaseRegistry.normalizeConfigOption: only the bare booleans coerce. */
function normalizeYarnConfigValue(value: string): YarnValue {
  return value === 'true' ? true : value === 'false' ? false : value;
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

// Bridges the registry surfaces yarn resolves that npm cannot see, and returns
// the registry the spawned npm will query for the package (yarn's getRegistry
// order: a scoped registry first, else the unscoped one, else npm's own
// default). That registry's nerf-dart is where bare global auth is re-keyed.
function resolveRegistry(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  cliYarnrcChain: RcFile[],
  scope: string | null
): string {
  const scopedRegistry = scope
    ? resolveScopedRegistry(env, npmrcChain, yarnrcChain, scope)
    : undefined;
  const unscopedRegistry = resolveUnscopedRegistry(
    env,
    npmrcChain,
    yarnrcChain,
    cliYarnrcChain
  );
  // npm's own default when nothing is configured (yarn's default is npmjs' CNAME
  // and npm stays on registry.npmjs.org), so the dart lands where npm queries.
  return scopedRegistry ?? unscopedRegistry ?? 'https://registry.npmjs.org/';
}

function resolveUnscopedRegistry(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  cliYarnrcChain: RcFile[]
): string | undefined {
  // 1. A `--registry`/`--install.registry` line in a CLI-rc .yarnrc lands at
  // yarn's CLI tier, above npm_config_registry env, so it always needs bridging.
  const cliRegistry =
    firstString(cliYarnrcChain, '--install.registry') ??
    firstString(cliYarnrcChain, '--registry');
  if (cliRegistry) {
    setRegistry(env, cliRegistry.value);
    return cliRegistry.value;
  }
  // 2. npm_config_registry env: npm resolves it natively.
  const npmConfigRegistry = readEnvVar(process.env, 'npm_config_registry');
  if (npmConfigRegistry !== undefined) {
    return npmConfigRegistry;
  }
  // 3. YARN_REGISTRY env (yarn-only).
  const yarnRegistryEnv = readEnvVar(process.env, 'YARN_REGISTRY');
  if (yarnRegistryEnv !== undefined) {
    setRegistry(env, yarnRegistryEnv);
    return yarnRegistryEnv;
  }
  // 4. The .npmrc chain is exhausted before .yarnrc is consulted.
  const npmrcRegistry = firstString(npmrcChain, 'registry');
  if (npmrcRegistry) {
    if (!npmrcRegistry.npmNative) {
      setRegistry(env, npmrcRegistry.value);
    }
    return npmrcRegistry.value;
  }
  // 5. .yarnrc registry (every entry yarn-only). The yarn default is npmjs'
  // CNAME; leaving npm on registry.npmjs.org keeps nerf-darted auth working.
  const yarnrcRegistry = firstString(yarnrcChain, 'registry');
  if (
    yarnrcRegistry &&
    yarnrcRegistry.value.replace(/\/$/, '') !== YARN_CLASSIC_DEFAULT_REGISTRY
  ) {
    setRegistry(env, yarnrcRegistry.value);
    return yarnrcRegistry.value;
  }
  return undefined;
}

// Bridges the scoped registry when a yarn-only surface wins, and returns the
// scoped registry yarn resolves (native or not) so auth can dart onto it.
function resolveScopedRegistry(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  yarnrcChain: RcFile[],
  scope: string
): string | undefined {
  const scopedKey = `${scope}:registry`;
  // npm config (env + .npmrc) wins over .yarnrc for scoped keys.
  const envRegistry = process.env[`npm_config_${scopedKey}`];
  if (envRegistry !== undefined) {
    return envRegistry;
  }
  const npmScoped = firstString(npmrcChain, scopedKey);
  if (npmScoped) {
    if (!npmScoped.npmNative) {
      setScopedRegistry(env, scope, npmScoped.value);
    }
    return npmScoped.value;
  }
  const yarnScoped = firstString(yarnrcChain, scopedKey);
  if (yarnScoped) {
    setScopedRegistry(env, scope, yarnScoped.value);
    return yarnScoped.value;
  }
  return undefined;
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
  const cafile =
    yarnEnvOption('cafile') ??
    resolveOption(firstString, npmrcChain, yarnrcChain, 'cafile');
  if (cafile) {
    setCafile(env, resolveYarnPath(cafile, root, home));
  }

  // Only the .yarnrc side: a `strict-ssl` in an .npmrc does not reach the
  // setting yarn reads (verified on 1.22.22, where an .npmrc `strict-ssl=false`
  // leaves verification on), so bridging one would turn TLS verification off for
  // the spawned npm where neither yarn nor npm turns it off.
  // An env value arrives as a string; yarn coerces the bare booleans out of it
  // before the Boolean() check, so `YARN_STRICT_SSL=false` really does turn
  // verification off where a quoted `"false"` in a file does not.
  const strictSslEnv = yarnEnvOption('strict-ssl');
  const strictSsl =
    strictSslEnv !== undefined
      ? normalizeYarnConfigValue(strictSslEnv)
      : firstDefined(yarnrcChain, 'strict-ssl')?.value;
  if (strictSsl !== undefined && !truthyStrictSsl(strictSsl)) {
    setStrictSsl(env, false);
  }

  setProxies(env, {
    httpProxy:
      yarnEnvOption('proxy') ??
      resolveOption(firstString, npmrcChain, yarnrcChain, 'proxy'),
    httpsProxy:
      yarnEnvOption('https-proxy') ??
      resolveOption(firstString, npmrcChain, yarnrcChain, 'https-proxy'),
  });
}

/**
 * The `yarn_`-prefixed env tier for an option key (YARN_CAFILE, YARN_STRICT_SSL,
 * YARN_PROXY, ...). BaseRegistry.init merges it before any rc file is read and
 * loadConfig keeps what it already has, so it outranks every file; npm cannot
 * see it under that name. A `npm_config_` value outranks it in turn, and npm
 * reads that one for itself, so it needs no bridge and only has to suppress
 * this one.
 */
function yarnEnvOption(key: string): string | undefined {
  const envKey = key.replace(/-/g, '_');
  if (readEnvVar(process.env, `npm_config_${envKey}`) !== undefined) {
    return undefined;
  }
  return readEnvVar(process.env, `yarn_${envKey}`);
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
  // yarn classic env-replaces ${VAR} in .npmrc values via normalizeConfig, so
  // resolve them here rather than leaving the spawned npm to apply its own
  // grammar to whatever we bridge.
  // npm's ini parser yields strings; coerce the booleans npm itself recognizes
  // so option semantics line up with the .yarnrc side.
  const result = new Map<string, YarnValue>();
  for (const [key, value] of map) {
    result.set(key, normalizeYarnConfigValue(expandEnvVars(value)));
  }
  return result;
}

/**
 * Parses yarn classic's .yarnrc into a last-write-wins map, or null when the
 * file is missing, unreadable, or has a construct yarn's parser rejects. Yarn
 * reads it with its lockfile parser, so a single malformed line throws and
 * costs the whole file, not just that line, and yarn carries on as though the
 * file declared nothing (verified on 1.22.22).
 *
 * @yarnpkg/lockfile on npm is a 2018 snapshot of that parser and has since
 * diverged: its name token excludes `.`, so it rejects the `cafile ./ca.pem`
 * that yarn 1.22 accepts. Reading with it would drop whole files yarn honors.
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
  try {
    return parseYarnrc(raw);
  } catch {
    return null;
  }
}

type YarnToken =
  | { type: 'value'; value: YarnValue }
  | { type: 'indent'; value: number }
  | { type: 'colon' | 'comma' | 'newline' | 'eof' | 'invalid'; value?: never };

/**
 * Yarn's lockfile tokenizer. A bare word runs until `:`, a space, a comma or a
 * newline and starts with a letter, `/`, `.` or `-`, which is why an unquoted
 * URL value breaks the file: its `://` splits into three tokens.
 */
function* tokenizeYarnrc(input: string): Generator<YarnToken> {
  let lastNewline = false;
  while (input.length) {
    let chop = 0;
    if (input[0] === '\n' || input[0] === '\r') {
      chop = input[0] === '\r' && input[1] === '\n' ? 2 : 1;
      yield { type: 'newline' };
    } else if (input[0] === '#') {
      const end = input.indexOf('\n');
      chop = end === -1 ? input.length : end;
    } else if (input[0] === ' ') {
      if (lastNewline) {
        let size = 1;
        while (input[size] === ' ') {
          size++;
        }
        if (size % 2) {
          throw new Error('Invalid number of spaces');
        }
        chop = size;
        yield { type: 'indent', value: size / 2 };
      } else {
        chop = 1;
      }
    } else if (input[0] === '"') {
      let i = 1;
      for (; i < input.length; i++) {
        if (
          input[i] === '"' &&
          !(input[i - 1] === '\\' && input[i - 2] !== '\\')
        ) {
          i++;
          break;
        }
      }
      chop = i;
      try {
        yield { type: 'value', value: JSON.parse(input.slice(0, i)) };
      } catch {
        yield { type: 'invalid' };
      }
    } else if (/^[0-9]/.test(input)) {
      const digits = /^[0-9]+/.exec(input)[0];
      chop = digits.length;
      yield { type: 'value', value: +digits };
    } else if (input.startsWith('true')) {
      chop = 4;
      yield { type: 'value', value: true };
    } else if (input.startsWith('false')) {
      chop = 5;
      yield { type: 'value', value: false };
    } else if (input[0] === ':') {
      chop = 1;
      yield { type: 'colon' };
    } else if (input[0] === ',') {
      chop = 1;
      yield { type: 'comma' };
    } else if (/^[a-zA-Z/.-]/.test(input)) {
      let i = 0;
      while (i < input.length && !':  \n\r,'.includes(input[i])) {
        i++;
      }
      chop = i;
      yield { type: 'value', value: input.slice(0, i) };
    } else {
      yield { type: 'invalid' };
    }
    if (!chop) {
      throw new Error('Made no progress');
    }
    lastNewline = input[0] === '\n' || (input[0] === '\r' && input[1] === '\n');
    input = input.slice(chop);
  }
  yield { type: 'eof' };
}

/**
 * Yarn's lockfile parser, flattened: only top-level scalar settings are kept,
 * since nothing read here is an object, but a nested block is still parsed so
 * its presence does not discard the settings around it. Throws on anything
 * yarn's parser rejects.
 */
function parseYarnrc(raw: string): Map<string, YarnValue> {
  const tokens = tokenizeYarnrc(raw);
  const map = new Map<string, YarnValue>();
  const next = (): YarnToken => tokens.next().value as YarnToken;
  let token: YarnToken = next();

  const parseLevel = (indent: number, keep: boolean): void => {
    while (true) {
      if (token.type === 'newline') {
        token = next();
        if (!indent) {
          continue;
        }
        if (token.type !== 'indent') {
          return;
        }
        if (token.value !== indent) {
          return;
        }
        token = next();
      } else if (token.type === 'indent') {
        if (token.value !== indent) {
          return;
        }
        token = next();
      } else if (token.type === 'eof') {
        return;
      } else if (token.type === 'value') {
        const keys = [String(token.value)];
        token = next();
        while (token.type === 'comma') {
          token = next();
          if (token.type !== 'value') {
            throw new Error('Expected string');
          }
          keys.push(String(token.value));
          token = next();
        }
        const wasColon = token.type === 'colon';
        if (wasColon) {
          token = next();
        }
        if (token.type === 'value') {
          const value = token.value;
          if (keep) {
            for (const key of keys) {
              map.set(key, value);
            }
          }
          token = next();
        } else if (wasColon) {
          // A nested block: parsed for its tokens, dropped from the flat map.
          parseLevel(indent + 1, false);
          if (indent && token.type !== 'indent') {
            return;
          }
        } else {
          throw new Error('Invalid value type');
        }
      } else {
        throw new Error(`Unknown token: ${token.type}`);
      }
    }
  };

  parseLevel(0, true);
  return map;
}
