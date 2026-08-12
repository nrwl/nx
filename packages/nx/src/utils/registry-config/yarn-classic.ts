import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { readYamlFile } from '../fileutils';
import { readNpmrcMap } from '../package-manager-config/npmrc';
import {
  ancestorDirectories,
  escapeNpmEnvExpr,
  expandYarnEnvVars,
  getPackageScope,
  readEnvVar,
  readNpmConfigEnv,
  requestNerfDart,
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
 * Unscoped registry: a `--registry`/`--install.registry` line in a CLI-rc file
 * (yarn injects it as a default CLI arg) > npm_config_registry env >
 * YARN_REGISTRY env > .npmrc registry (the npm-config chain is exhausted first)
 * > .yarnrc registry > https://registry.yarnpkg.com.
 *
 * Scoped: @scope:registry in npm config (env/.npmrc) > @scope:registry in
 * .yarnrc > the unscoped chain.
 *
 * Option keys (cafile, strict-ssl, proxy) resolve the other way around, and off
 * the env first: `yarn_<key>` > .yarnrc > `npm_config_<key>` > .npmrc > yarn's
 * DEFAULTS. A key DEFAULTS carries never reaches the npm tier at all, which is
 * why no npm-config source can turn TLS verification off for yarn. `always-auth`
 * is not one of these: it is read off the npm registry's own config for the
 * registry being queried, not off .yarnrc.
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
// `false` is a boolean, a bare integer a number, everything else (quoted, or a
// bare word) a string.
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

  // yarn ranks <prefix>/etc above the real home it adds under root, so the
  // secondary home tier follows etc.
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
    map: toYarnValueMap(readChainNpmrcMap(s.npmrcPath)),
  }));
  const cliRcPaths = yarnCliRcPaths(root, ancestors, primary.dir);
  // The two readers overlap on the tiers above without covering each other, and
  // what a file tolerates depends on which of them reach it, so each read is
  // derived from the two path sets rather than from the tier it sits in.
  const lookedUpPaths = new Set(sources.map((s) => s.yarnrcPath));
  const ungatedPaths = new Set(cliRcPaths);
  const yarnrcChain: RcFile[] = sources.map((s) => ({
    // npm never reads .yarnrc.
    npmNative: false,
    map: readYarnrcMap(
      s.yarnrcPath,
      ungatedPaths.has(s.yarnrcPath) ? 'both' : 'looked-up'
    ),
  }));
  const cliRegistryChain: RcFile[] = cliRcPaths.map((rcPath) => ({
    npmNative: false,
    map: readYarnrcMap(rcPath, lookedUpPaths.has(rcPath) ? 'both' : 'cli-rc'),
  }));

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
  // Everything above is what yarn itself ends up with: an .npmrc value with its
  // own escape rule applied, and a .yarnrc one it never env-replaces at all.
  // Both can still hold a `${VAR}` the spawned npm would resolve, so escape
  // them back into the text npm hands on unchanged.
  for (const [key, value] of Object.entries(env)) {
    env[key] = escapeNpmEnvExpr(value);
  }
  return env;
}

// yarn reads registry auth only from the .npmrc chain, never .yarnrc. Bridge a
// yarn-only winner only where yarn would send it: bridging unconditionally makes
// npm authenticate where yarn stays anonymous, and 401 on a registry that serves
// the package without credentials.
function resolveAuth(
  env: NpmConfigEnv,
  npmrcChain: RcFile[],
  scope: string | null,
  authRegistry: string
): void {
  const prefixes = registryOptionPrefixes(authRegistry);
  const requestDart = requestNerfDart(authRegistry);
  // always-auth is read for the registry yarn is about to query, not for the
  // dart a credential came from.
  const authenticates = scope !== null || alwaysAuthFor(prefixes, npmrcChain);
  if (!authenticates) {
    if (requestDart) {
      warnNativeCredential(
        env,
        requestDart,
        'yarn',
        'yarn does send it for scoped packages, and for any registry with always-auth set, so removing it from .npmrc would stop those from authenticating too.',
        (key) => {
          const match = firstString(npmrcChain, key);
          return (
            readNpmConfigEnv(process.env, key) ??
            (match?.npmNative ? match.value : undefined)
          );
        }
      );
    }
    return;
  }
  if (!requestDart) {
    return;
  }
  // Only what the ladder itself resolved is carried over. yarn picks a
  // credential per registry, never per URL: whatever request it is about to
  // make, the header is getAuthByRegistry's answer for the registry it resolved,
  // and a key matching the request URL only decides whether to send one at all.
  // So any other nerf-darted key in the chain is one yarn would not have read,
  // and copying it over verbatim would only put it on npm's own walk.
  //
  // getAuthByRegistry runs the whole ladder for one form before it tries the
  // next, so a bare token outranks a registry-scoped basic pair, and the pair
  // only counts when both halves resolve. npm honors auth in the nerf-darted
  // form alone, so whichever form wins is re-keyed onto the dart. Re-keying a
  // bare key out of a file npm reads for itself is not wasted either: npm
  // refuses to run on a bare auth key in its own config (ERR_INVALID_AUTH,
  // --force included) before any overlay matters. The _auth/_password base64
  // carries over as-is.
  let winner: { form: readonly string[]; rank: number; values: LadderMatch[] };
  for (let rank = 0; rank < CREDENTIAL_FORMS.length && !winner; rank++) {
    const form = CREDENTIAL_FORMS[rank];
    const values: LadderMatch[] = [];
    for (const key of form) {
      const match = resolveCredential(prefixes, npmrcChain, key);
      if (!match) {
        break;
      }
      values.push(match);
    }
    if (values.length === form.length) {
      winner = { form, rank, values };
    }
  }
  if (!winner) {
    return;
  }
  // npm already holds this at the dart it starts its own walk from, so writing
  // it there would only restate it.
  if (
    !winner.values.every(
      (match) => match.prefix === requestDart && match.npmNative
    )
  ) {
    winner.form.forEach((key, index) => {
      env[`npm_config_${requestDart}:${key}`] = winner.values[index].value;
    });
  }
  // yarn sends this same credential to any other host it already holds one for.
  // requestNeedsAuth only asks whether some key covers the URL about to be
  // fetched, a tarball served off the registry's path or host among them, and
  // the header stays getAuthByRegistry's answer for the resolved registry. npm
  // reads that host's own key instead, so the winner is written there too.
  //
  // Every declared dart under a gated one gets it, not just the gating dart:
  // npm settles on the deepest declared dart covering the URL, so leaving a
  // deeper one alone would let it answer in the gated one's place. Within a
  // dart, only a form npm ranks above the winner has to be cancelled.
  const outranking = CREDENTIAL_FORMS.slice(0, winner.rank).flat();
  for (const dart of gatedAuthDarts(npmrcChain, requestDart)) {
    winner.form.forEach((key, index) => {
      env[`npm_config_${dart}:${key}`] = winner.values[index].value;
    });
    for (const key of outranking) {
      // Read across npm's own tiers rather than yarn's: a yarn-only file
      // declaring this key first hides an npm-native one that npm still reads.
      const native =
        readNpmConfigEnv(process.env, `${dart}:${key}`) ??
        npmNativeValue(npmrcChain, `${dart}:${key}`);
      if (native !== undefined) {
        // npm reads this one before the form yarn picked and would answer with
        // the host's own credential. An empty value leaves npm reading the
        // file's; the `null` literal is what cancels it.
        env[`npm_config_${dart}:${key}`] = 'null';
      }
    }
  }
}

/** The value the spawned npm reads for `key` from a file it opens itself. */
function npmNativeValue(npmrcChain: RcFile[], key: string): string | undefined {
  for (const file of npmrcChain) {
    const value = file.npmNative ? file.map?.get(key) : undefined;
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

/**
 * A dart read twice over: as npm keys its own lookup, and as yarn folds it
 * before matching. yarn puts both sides through normalize-url first, which
 * lower-cases the host, drops a trailing dot and a leading `www.` from it, and
 * drops a fragment, collapses duplicate slashes, percent-decodes the path
 * (decodeURI, so reserved escapes like %2F stay put), and drops its trailing
 * slash. npm normalizes none of that, so the two readings have to stay apart:
 * the folded one decides what a gate covers, the npm one decides which key the
 * overlay is written under.
 */
interface DartParts {
  host: string;
  matchHost: string;
  path: string;
  /** The folded path npm's walk can land on: collapsed and decoded, slash kept. */
  foldPath: string;
  /** foldPath without its trailing slash, the spelling the prefix test runs on. */
  matchPath: string;
}

function dartParts(dart: string): DartParts | null {
  try {
    // The dart is protocol-relative; lending it one lets the URL parser
    // lower-case the host, which is what makes `//CDN.example.com/` answer for
    // a request npm keys as `//cdn.example.com/`.
    const url = new URL(`http:${dart}`);
    // yarn matches on a path that still carries the query, so a query-bearing
    // key only covers a request whose own sorted query extends it, which a
    // tarball URL's never does; dropping the dart reproduces that. A fragment
    // is different: normalize-url deletes it, so the dart matches on the path
    // in front of it, which url.pathname already is.
    if (url.search) {
      return null;
    }
    // The parser also rewrites a host yarn's own normalization leaves alone, a
    // legacy IPv4 spelling (`127.1`) or an IDN among them. Matching on the
    // rewritten one would open a host yarn never opened, so anything the parse
    // did not leave as it found it is dropped instead.
    if (dart.slice(2).split(/[/#]/)[0].toLowerCase() !== url.hostname) {
      return null;
    }
    // normalize-url's order: collapse, decode, then the trailing slash. A
    // malformed escape throws out of decodeURI into the catch below, which is
    // where yarn's own normalize call would have thrown too.
    const foldPath = decodeURI(url.pathname.replace(/\/{2,}/g, '/'));
    return {
      host: url.host,
      matchHost: url.hostname.replace(/\.$/, '').replace(/^www\./, ''),
      path: url.pathname,
      foldPath,
      matchPath: foldPath.replace(/(?!^)\/$/, ''),
    };
  } catch {
    return null;
  }
}

/**
 * Every dart the overlay has to answer for once yarn's requestNeedsAuth opens a
 * host up: the gating darts themselves, and any dart declaring a credential
 * underneath one, which npm would otherwise settle on first.
 *
 * Both sides are compared the way yarn compares them, host against host and
 * then path against path. Run as one string the relation would read
 * `//h.example` as covering `//h.example.evil` and hand that origin the
 * registry's credential. The path stays a plain prefix test, which is yarn's
 * own. The registry's dart is left out, since the winner already goes there.
 */
function gatedAuthDarts(
  npmrcChain: RcFile[],
  requestDart: string
): Set<string> {
  const gates: DartParts[] = [];
  const declared: DartParts[] = [];
  for (const file of npmrcChain) {
    if (!file.map) {
      continue;
    }
    for (const key of file.map.keys()) {
      const parts = key.split(':');
      if (!parts[0].startsWith('//')) {
        continue;
      }
      const dart = dartParts(parts[0]);
      if (!dart) {
        continue;
      }
      // yarn's own condition, precedence included: the length test binds to
      // `_authToken` alone. So a host carrying a port, which puts that port
      // where the key name has to be, gates through neither.
      if (
        (parts.length === 2 && parts[1] === '_authToken') ||
        parts[1] === '_password'
      ) {
        gates.push(dart);
      }
      if (parts.length === 2 && AUTH_KEYS.has(parts[1])) {
        declared.push(dart);
      }
    }
  }
  const darts = new Set<string>();
  for (const gate of gates) {
    for (const dart of [gate, ...declared]) {
      if (
        dart.matchHost !== gate.matchHost ||
        !dart.matchPath.startsWith(gate.matchPath)
      ) {
        continue;
      }
      // The folding means one dart can answer for two spellings on each side,
      // host and path, and which ones the fetch uses is not known here, so
      // every pairing goes in: npm walks the tarball URL's own spelling, so a
      // key folded away from it is only found where the walk lands.
      for (const host of new Set([dart.host, dart.matchHost])) {
        for (const path of new Set([dart.path, dart.foldPath])) {
          const key = `//${host}${path}`;
          if (key !== requestDart) {
            darts.add(key);
          }
        }
      }
    }
  }
  return darts;
}

/**
 * The config-key prefixes yarn's NpmRegistry.getRegistryOption tries, in its
 * order: the registry itself, then the same without the protocol, then without
 * a trailing `registry` segment, recursing into each. It never climbs a path
 * the way npm does, so the directory above the registry is reachable only
 * through that suffix rewrite, which carries no segment boundary of its own: a
 * `.../myregistry/` registry strips to `.../my/`.
 */
function registryOptionPrefixes(registry: string): string[] {
  const prefixes: string[] = [];
  const visit = (candidate: string): void => {
    const prefix = candidate.endsWith('/') ? candidate : `${candidate}/`;
    if (prefixes.includes(prefix)) {
      return;
    }
    prefixes.push(prefix);
    if (/^https?:/i.test(prefix)) {
      visit(prefix.replace(/^https?:/i, ''));
    }
    if (/registry\/?$/.test(prefix)) {
      visit(prefix.replace(/registry\/?$/, ''));
    }
  };
  visit(registry);
  return prefixes;
}

interface LadderMatch extends Match<string> {
  /** null for the bare key yarn falls back to, which names no registry. */
  prefix: string | null;
}

// getRegistryOrGlobalOption chains the ladder and then the bare key with `||`,
// so an empty value falls through rather than settling the lookup.
function resolveCredential(
  prefixes: string[],
  npmrcChain: RcFile[],
  key: string
): LadderMatch | undefined {
  for (const prefix of prefixes) {
    const match = firstString(npmrcChain, `${prefix}:${key}`);
    if (match?.value) {
      return { ...match, prefix };
    }
  }
  const bare = firstString(npmrcChain, key);
  return bare?.value ? { ...bare, prefix: null } : undefined;
}

// .yarnrc never feeds always-auth: yarn reads it from NpmRegistry's own config,
// walking its registry ladder before the bare key. Unlike resolveOption this
// ignores npmNative, since it drives the auth gate rather than a bridge, and it
// chains with `||`, so a falsy rung falls through to the next.
function alwaysAuthFor(prefixes: string[], npmrcChain: RcFile[]): boolean {
  for (const prefix of prefixes) {
    const key = `${prefix}:always-auth`;
    if (yarnConfigValue(key, envReachable(key) ? key : null, npmrcChain)) {
      return true;
    }
  }
  // The bare key's env spelling carries the underscore mergeEnv rewrites into
  // the dash an rc file spells out.
  return Boolean(yarnConfigValue('always-auth', 'always_auth', npmrcChain));
}

// mergeEnv lowercases the whole variable name and stores it through objectPath,
// which splits on `.` into nested objects while every read is flat, so a
// registry-scoped env key only reaches yarn dot-free and already lowercase (a
// key for //localhost:PORT/ authenticates an unscoped fetch, the same key for
// //127.0.0.1:PORT/ does not).
function envReachable(key: string): boolean {
  return !key.includes('.') && key === key.toLowerCase();
}

// yarn merges the `yarn_` env prefix before any rc file is read and then
// `npm_config_` over it into the same flat map, so an env value replaces the
// file's at that key and npm's spelling replaces yarn's.
function yarnConfigValue(
  key: string,
  envName: string | null,
  npmrcChain: RcFile[]
): YarnValue | undefined {
  if (envName !== null) {
    const fromEnv =
      readEnvVar(process.env, `npm_config_${envName}`) ??
      readEnvVar(process.env, `yarn_${envName}`);
    if (fromEnv !== undefined) {
      return normalizeYarnConfigValue(fromEnv);
    }
  }
  return firstDefined(npmrcChain, key)?.value;
}

/** Mirrors yarn's BaseRegistry.normalizeConfigOption. */
function normalizeYarnConfigValue(value: string): YarnValue {
  return value === 'true' ? true : value === 'false' ? false : value;
}

// getAuthByRegistry's order: a bearer token, else a basic one, else the
// username/password pair, which it only sends when both halves resolve.
const CREDENTIAL_FORMS: readonly string[][] = [
  ['_authToken'],
  ['_auth'],
  ['username', '_password'],
];

// Every key npm's own hasAuth reads a dart as authenticated on. The client
// certificate pair is in because npm settles on the deepest dart carrying any
// of these, even though it ranks the pair below all three forms above.
const AUTH_KEYS = new Set([...CREDENTIAL_FORMS.flat(), 'certfile', 'keyfile']);

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
  // yarn's default is npmjs' CNAME and npm stays on registry.npmjs.org, so the
  // dart lands where npm queries.
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

// Returns the scoped registry yarn resolves even when npm reads it natively, so
// auth can dart onto it.
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
  const cafile =
    yarnEnvOption('cafile') ??
    resolveOption(firstString, npmrcChain, yarnrcChain, 'cafile');
  if (cafile) {
    setCafile(env, resolveYarnPath(cafile, root, home));
  }

  // DEFAULTS carries `strict-ssl`, so no npm-config source reaches yarn's value
  // (an .npmrc `strict-ssl=false` and `npm_config_strict_ssl=false` both leave
  // verification on). That cuts both ways: npm also has to be told to keep
  // verifying where its own config would stop, so a declared value is bridged in
  // either direction. An env value arrives as a string and yarn coerces the bare
  // booleans out of it first, so `YARN_STRICT_SSL=false` does turn verification
  // off where a quoted `"false"` in a file does not.
  const strictSslEnv = yarnEnvOption('strict-ssl');
  const strictSsl =
    strictSslEnv !== undefined
      ? normalizeYarnConfigValue(strictSslEnv)
      : firstDefined(yarnrcChain, 'strict-ssl')?.value;
  if (
    strictSsl !== undefined &&
    truthyStrictSsl(strictSsl) !== npmVerifiesTls(npmrcChain)
  ) {
    setStrictSsl(env, truthyStrictSsl(strictSsl));
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
 * The `yarn_` env tier for an option key (YARN_CAFILE, YARN_STRICT_SSL, ...).
 * yarn merges it before any rc file is read and getOption consults yarn's own
 * config before npm's, so it outranks every file and a `npm_config_` value of
 * the same key (with both YARN_CAFILE and npm_config_cafile set, `yarn config
 * get cafile` returns the YARN_ one). npm cannot see it under that name.
 */
function yarnEnvOption(key: string): string | undefined {
  return readEnvVar(process.env, `yarn_${key.replace(/-/g, '_')}`);
}

// Yarn's option resolution below its own env tier: .yarnrc, then npm's config.
// Returns only a value that needs bridging, so a native .npmrc winner comes back
// undefined.
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
  // The `npm_config_` env tier outranks every .npmrc and npm reads it itself, so
  // a value there needs no bridge and shadows the file chain below it.
  if (readNpmConfigEnv(process.env, key) !== undefined) {
    return undefined;
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

// yarn's userHomeDir.default is /usr/local/share when running as root (uid 0, no
// FAKEROOTKEY) and the real home otherwise; under root the real home stays on as
// a second tier. The primary is the tilde-expansion base, and npm reads only the
// real home natively.
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

/**
 * The files yarn injects `--`-prefixed lines from as default CLI args. It
 * collects them through getRcPaths, a wider set than the tiers the registry
 * client reads, and merges them last-wins, so this list runs the other way
 * round: highest precedence first, to be read first-wins.
 * See https://github.com/yarnpkg/yarn/blob/740c38c3a962c30ddb344a919bbfb7065620714b/src/util/rc.js#L11-L62
 */
function yarnCliRcPaths(
  root: string,
  ancestors: string[],
  primaryHome: string
): string[] {
  const paths: string[] = [];
  if (process.env.YARN_CONFIG) {
    paths.push(process.env.YARN_CONFIG);
  }
  // Read straight off the env here rather than through os.homedir(), and every
  // home tier dropped when it is unset, both as yarn does it.
  const home =
    process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME;
  if (home) {
    paths.push(
      join(home, '.yarnrc.yml'),
      join(home, '.yarnrc'),
      join(home, '.yarn', 'config'),
      join(home, '.config', 'yarn'),
      join(home, '.config', 'yarn', 'config'),
      yarnConfigDir(primaryHome)
    );
  }
  if (process.platform !== 'win32') {
    // The literal /etc, not the <prefix>/etc tier the registry client reads.
    paths.push(join('/etc', 'yarnrc'), join('/etc', 'yarn', 'config'));
  }
  // A .yarnrc.yml sibling rides along with every .yarnrc yarn names, and lands
  // above it.
  for (const dir of [root, ...ancestors]) {
    paths.push(join(dir, '.yarnrc.yml'), join(dir, '.yarnrc'));
  }
  return paths;
}

// Mirrors yarn's getConfigDir, which resolves against userHomeDir: the same
// root-aware home yarnHomeTiers picks as the primary tier.
function yarnConfigDir(primaryHome: string): string {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, 'Yarn', 'Config')
      : join(primaryHome, '.config', 'yarn');
  }
  return process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'yarn')
    : join(primaryHome, '.config', 'yarn');
}

// Mirrors yarn's getGlobalPrefix.
function globalEtcDir(): string {
  // Falsy rather than absent, so an exported but empty PREFIX falls through to
  // the executable's own prefix instead of resolving `etc` against the cwd.
  if (process.env.PREFIX) {
    return join(process.env.PREFIX, 'etc');
  }
  if (process.platform === 'win32') {
    return join(dirname(process.execPath), 'etc');
  }
  const prefix = dirname(dirname(process.execPath));
  // DESTDIR reroots the prefix on Unix only, and only once PREFIX has passed.
  return join(
    process.env.DESTDIR ? join(process.env.DESTDIR, prefix) : prefix,
    'etc'
  );
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

// yarn stores a bare `false`/number as a non-string, never a valid
// registry/path/proxy value, so skip those entries rather than coercing.
function firstString(chain: RcFile[], key: string): Match<string> | undefined {
  for (const file of chain) {
    const value = file.map?.get(key);
    if (typeof value === 'string') {
      return { value, npmNative: file.npmNative };
    }
  }
  return undefined;
}

// yarn computes strictSSL as Boolean(getOption('strict-ssl')), so a quoted
// `"false"` (a string) keeps verification on.
function truthyStrictSsl(value: YarnValue): boolean {
  return Boolean(value);
}

// Only a literal `false` turns npm's own strict-ssl off, and toYarnValueMap has
// already typed that as a boolean.
function npmVerifiesTls(npmrcChain: RcFile[]): boolean {
  const fromEnv = readNpmConfigEnv(process.env, 'strict-ssl');
  if (fromEnv !== undefined) {
    return fromEnv !== 'false';
  }
  const native = firstDefined(
    npmrcChain.filter((file) => file.npmNative),
    'strict-ssl'
  );
  return native?.value !== false;
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

// yarn looks each .npmrc in its chain up before opening it, and unlike .yarnrc
// nothing reads it a second time ungated, so whatever the lookup misses counts
// as absent and only a file it finds and cannot open aborts yarn.
function readChainNpmrcMap(path: string): Map<string, string> | null {
  if (!existsSync(path)) {
    return null;
  }
  const map = readNpmrcMap(path);
  if (map === 'unreadable') {
    // No resolution left to reproduce. Reading on without the file would
    // resolve the registry from the remaining ones, silently landing on an
    // ancestor's or the default.
    throw new Error(`The .npmrc at ${path} could not be read.`);
  }
  return map;
}

function toYarnValueMap(
  map: Map<string, string> | null
): Map<string, YarnValue> | null {
  if (!map) {
    return null;
  }
  // yarn env-replaces `${VAR}` in .npmrc values itself, and with a grammar of
  // its own, so expand here rather than leaving the spawned npm to apply its.
  // The ini reader yields strings; coercing the bare booleans lines these values
  // up with the .yarnrc side.
  const result = new Map<string, YarnValue>();
  for (const [key, value] of map) {
    result.set(key, normalizeYarnConfigValue(expandYarnEnvVars(value)));
  }
  return result;
}

/**
 * Which of yarn's two rc readers reach a file, since that is what its tolerance
 * depends on. The registry client looks the file up and then opens what the
 * lookup found; the CLI-arg pass opens it with no lookup in front. A file both
 * reach is read ungated but with the stricter pass's tolerance.
 */
type YarnrcReaders = 'looked-up' | 'cli-rc' | 'both';

/**
 * Parses one of yarn classic's rc files into a last-write-wins map. Yarn reads
 * it with its lockfile parser first, so one rejected line costs the whole file
 * rather than just that line, then retries the whole file with js-yaml and
 * honors what the retry accepts, which is how `registry: https://host/` works
 * despite the lockfile grammar throwing on it. A `.yml` skips straight to the
 * retry's parser.
 * See https://github.com/yarnpkg/yarn/blob/740c38c3a962c30ddb344a919bbfb7065620714b/src/lockfile/parse.js#L384-L409
 *
 * @yarnpkg/lockfile on npm is a 2018 snapshot of that parser and has since
 * diverged: its name token excludes `.`, so it rejects the `cafile ./ca.pem`
 * that yarn 1.22 accepts. Reading with it would drop whole files yarn honors.
 */
function readYarnrcMap(
  path: string,
  readers: YarnrcReaders
): Map<string, YarnValue> | null {
  // Whatever the lookup misses is absent to yarn as well, but only where no
  // second reader opens the file behind its back.
  if (readers === 'looked-up' && !existsSync(path)) {
    return null;
  }
  // Unconditional even for a `.yml`, which parses from the path below: this
  // open is what classifies the fault, and neither parser carries a tolerance.
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (e) {
    // The CLI-arg pass spares ENOENT and EISDIR. A file the registry client
    // also reads keeps only ENOENT, since a directory passes its lookup and
    // then dies on the open. Anything left leaves no resolution to reproduce.
    // See https://github.com/yarnpkg/yarn/blob/740c38c3a962c30ddb344a919bbfb7065620714b/src/util/rc.js#L64-L79
    if (
      e?.code === 'ENOENT' ||
      (e?.code === 'EISDIR' && readers === 'cli-rc')
    ) {
      return null;
    }
    throw new Error(`The yarn config at ${path} could not be read.`);
  }
  // A .yml goes to the failsafe YAML schema alone, with no lockfile grammar in
  // front and no retry behind, which is why only a mapping declares anything.
  if (path.endsWith('.yml')) {
    const map = parseYarnrcAsYaml(path);
    // yarn keeps `yarn-path` alone from a .yml that names one, dropping the CLI
    // args read here.
    // See https://github.com/yarnpkg/yarn/blob/740c38c3a962c30ddb344a919bbfb7065620714b/src/rc.js#L55-L70
    return typeof map.get('yarnPath') === 'string' ? new Map() : map;
  }
  try {
    return parseYarnrc(raw);
  } catch {
    return parseYarnrcAsYaml(path);
  }
}

/**
 * Yarn's own fallback for an rc file its lockfile parser rejects, and its only
 * parser for a `.yml`. The failsafe schema makes every scalar a string, and
 * classic passes the schema alone where berry also passes `json: true`, so a
 * duplicate key throws here rather than resolving last-wins.
 */
function parseYarnrcAsYaml(path: string): Map<string, YarnValue> {
  let loaded: unknown;
  try {
    loaded = readYamlFile(path, { failsafe: true });
  } catch {
    // Rejected by both parsers, where yarn rethrows the first error and dies
    // rather than reading on without the file. Keep the parse error out of the
    // message: it quotes the lines around the fault, which here can be
    // credential material.
    throw new Error(`The yarn config at ${path} could not be read.`);
  }
  const map = new Map<string, YarnValue>();
  // Yarn ignores a document that is not a mapping rather than failing, which is
  // how an unquoted `registry https://host/` (one bare scalar to YAML) ends up
  // declaring nothing.
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    return map;
  }
  for (const [key, value] of Object.entries(loaded)) {
    // Anything the failsafe schema did not make a string is a nested block, and
    // nothing read here is one. A `false` arriving as the truthy string 'false'
    // is yarn's own behavior, not a loss.
    if (typeof value === 'string') {
      map.set(key, value);
    }
  }
  return map;
}

type YarnToken =
  | { type: 'value'; value: YarnValue }
  | { type: 'indent'; value: number }
  | { type: 'colon' | 'comma' | 'newline' | 'eof' | 'invalid'; value?: never };

/**
 * Yarn's lockfile tokenizer. A bare word stops at `:`, which is why an unquoted
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
  // Yarn strips a UTF-8 BOM before tokenising (parse.js stripBOM); left in
  // place it breaks the first name token, dropping the file to the YAML retry,
  // which declares nothing for the yarn-grammar shape.
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
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
