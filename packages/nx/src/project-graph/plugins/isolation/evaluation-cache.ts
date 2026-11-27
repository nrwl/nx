import {
  type BigIntStats,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import type { PluginConfiguration } from '../../../config/nx-json';
import { hashArray, hashObject } from '../../../hasher/file-hasher';
import { workspaceDataDirectory } from '../../../utils/cache-directory';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { logger } from '../../../utils/logger';
import { NX_TMP_DIR } from '../../../utils/nx-tmp-dir';
import { canonicalDir } from '../../../utils/owned-private-dir';
import { nxVersion } from '../../../utils/versions';
import { globWithWorkspaceContext } from '../../../utils/workspace-context';
import type { CreateNodesContext, CreateNodesResult } from '../public-api';

/**
 * Reuses an isolated plugin's last `createNodes` results while nothing it
 * depended on has changed, so the plugin is not called and its worker is not
 * started. What it depended on:
 *
 * - the plugin's identity and options, `nx.json`, and the `NX_*` environment;
 * - the exact config files its pattern matched;
 * - which files exist under each config file's directory and each project
 *   root it produced (names only), which covers test discovery and existence
 *   checks;
 * - every file the worker and its children opened for reading while loading
 *   the plugin and during the call, by fingerprint;
 * - the entry names of every directory they listed, but not those entries'
 *   contents unless they were also read.
 *
 * A plugin's own result cache answers unchanged projects without reading
 * their inputs, so one call's reads cover only what it re-evaluated. Inputs
 * therefore carry forward from the previous entry, and the first entry comes
 * from a call made with plugin caches off. Their cache files are rewritten on
 * every run, so they are not inputs themselves.
 */

type CreateNodesResults = Array<
  readonly [plugin: string, file: string, result: CreateNodesResult]
>;

interface EvaluationEntry {
  configFiles: string[];
  listingHash: string;
  inputs: Array<[path: string, fingerprint: string]>;
  listings: Array<[dir: string, names: string]>;
  results: CreateNodesResults;
}

/** What one call touched: files it read, directories it listed, files it wrote. */
export interface CallTrace {
  reads: string[];
  listings: string[];
  writes: string[];
}

export interface TraceMarkers {
  logPath: string;
  /** The worker's entry script. Its absence means tracing never started. */
  workerScript: string;
}

const CACHE_DIR = join(workspaceDataDirectory, 'plugin-evaluations');
const caseInsensitive = process.platform === 'win32';

function samePath(a: string, b: string): boolean {
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isUnder(path: string, dir: string): boolean {
  const p = caseInsensitive ? path.toLowerCase() : path;
  const d = caseInsensitive ? dir.toLowerCase() : dir;
  return p === d || p.startsWith(d.endsWith(sep) ? d : d + sep);
}

/**
 * A hardlinked file's ctime moves whenever any link to it is added or removed,
 * anywhere on the machine, as pnpm does with its store on every install. Its
 * own writes still move its mtime.
 */
function ownCtime(s: BigIntStats): bigint | null {
  return s.isFile() && s.nlink > 1n ? null : s.ctimeNs;
}

function describe(s: BigIntStats): string {
  return `${s.ino}:${s.size}:${s.mtimeNs}:${ownCtime(s) ?? '-'}`;
}

function fingerprint(path: string): string {
  try {
    return describe(statSync(path, { bigint: true }));
  } catch {
    return '-';
  }
}

/** The directory's entry names, or `-` when it cannot be listed. */
function listingFingerprint(dir: string): string {
  try {
    return hashArray(readdirSync(dir).sort());
  } catch {
    return '-';
  }
}

// nx's own state: the temp root (node's compile cache, native binding copies,
// re-signed binaries), ~/.nx (its database) and the daemon's directory. Derived
// from inputs already recorded, and rewritten as nx runs.
const derivedDirs = [
  NX_TMP_DIR,
  join(homedir(), '.nx'),
  join(workspaceDataDirectory, 'd'),
].flatMap((dir) => [dir, canonicalDir(dir)]);

/** The workspace context's file index, which nx keeps, not the plugin. */
function isWorkspaceIndex(path: string): boolean {
  return (
    isUnder(path, workspaceDataDirectory) &&
    basename(path).startsWith('nx_files')
  );
}

/** Files that change for reasons unrelated to what a plugin computes. */
function isNoise(path: string): boolean {
  if (derivedDirs.some((dir) => isUnder(path, dir))) {
    return true;
  }
  return (
    process.platform !== 'win32' &&
    ['/dev', '/proc', '/sys'].some((dir) => isUnder(path, dir))
  );
}

/**
 * The reads and listings attributed to one call: everything before the first
 * call marker, which is the worker loading the plugin, plus everything between
 * this call's markers. `null` when the trace cannot be trusted to be complete.
 */
export function readCallTrace(
  markers: TraceMarkers,
  traceId: string
): CallTrace | null {
  return readTrace(markers, traceId);
}

/**
 * The reads and listings of the worker loading the plugin, up to the first call
 * marker. Read once the load has answered, so everything that shaped the answer
 * is already in the log.
 */
export function readLoadTrace(markers: TraceMarkers): CallTrace | null {
  return readTrace(markers, null);
}

function readTrace(
  markers: TraceMarkers,
  traceId: string | null
): CallTrace | null {
  let lines: string[];
  try {
    lines = readFileSync(markers.logPath, 'utf8').split('\n');
  } catch {
    return null;
  }
  const reads = new Set<string>();
  const listings = new Set<string>();
  const writes = new Set<string>();
  // Reads before any call marker are the worker loading the plugin.
  let phase: 'load' | 'other' | 'call' | 'done' = 'load';
  let sawWorkerScript = false;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('!untraced ')) {
      logger.verbose(
        `[plugin-evaluation-cache] untraced exec: ${line.slice(10)}`
      );
      return null;
    }
    if (line.startsWith('!begin ')) {
      if (traceId === null) break;
      if (line === `!begin ${traceId}`) phase = 'call';
      else if (phase === 'load') phase = 'other';
      continue;
    }
    if (line.startsWith('!end ')) {
      if (line === `!end ${traceId}`) phase = 'done';
      continue;
    }
    if (phase !== 'load' && phase !== 'call') continue;
    if (line.startsWith('!list ')) {
      const dir = resolve(line.slice(6));
      if (!isNoise(dir)) listings.add(dir);
      continue;
    }
    if (line.startsWith('!write ')) {
      writes.add(resolve(line.slice(7)));
      continue;
    }
    const path = resolve(line);
    if (samePath(path, markers.workerScript)) sawWorkerScript = true;
    if (!isNoise(path)) reads.add(path);
  }
  const finished = traceId === null || phase === 'done';
  return sawWorkerScript && finished
    ? { reads: [...reads], listings: [...listings], writes: [...writes] }
    : null;
}

function identityOf(
  name: string,
  index: number | undefined,
  plugin: PluginConfiguration
): string[] {
  const config = typeof plugin === 'string' ? { plugin } : plugin;
  return [
    nxVersion,
    process.platform,
    name,
    String(index ?? ''),
    JSON.stringify([
      config?.plugin,
      config?.options,
      config?.include,
      config?.exclude,
    ]),
  ];
}

function nxEnv(): string[] {
  return Object.keys(process.env)
    .filter((k) => k.startsWith('NX_'))
    .sort()
    .map((k) => `${k}=${process.env[k]}`);
}

type Fingerprints = Pick<EvaluationEntry, 'inputs' | 'listings'>;

/** Whether every recorded file and listing still matches. */
function unchanged(
  plugin: string,
  { inputs, listings }: Fingerprints
): boolean {
  for (const [path, fp] of inputs) {
    if (fingerprint(path) !== fp) {
      logger.verbose(`[plugin-evaluation-cache] ${plugin}: ${path} changed`);
      return false;
    }
  }
  for (const [dir, names] of listings ?? []) {
    if (listingFingerprint(dir) !== names) {
      logger.verbose(
        `[plugin-evaluation-cache] ${plugin}: ${dir} entries changed`
      );
      return false;
    }
  }
  return true;
}

/**
 * Fingerprints what a traced run read and listed, or `null` when any of it
 * changed after `startedMs`, because the run may have seen either version.
 */
function fingerprintTrace(
  plugin: string,
  paths: Iterable<string>,
  dirs: Iterable<string>,
  written: ReadonlySet<string>,
  startedMs: number
): Fingerprints | null {
  const changed = (path: string) => {
    logger.verbose(
      `[plugin-evaluation-cache] not caching ${plugin}: ${path} changed while it ran`
    );
    return null;
  };
  const startedNs = BigInt(Math.floor(startedMs * 1_000_000));
  const changedDuringCall = (s: BigIntStats) =>
    s.mtimeNs >= startedNs || (ownCtime(s) ?? 0n) >= startedNs;

  // A missing path may have been removed during the call. Removing it
  // touched its nearest surviving ancestor.
  const removedDuringCall = (path: string): boolean => {
    for (let dir = dirname(path); ; dir = dirname(dir)) {
      try {
        return changedDuringCall(statSync(dir, { bigint: true }));
      } catch {
        if (dirname(dir) === dir) return false;
      }
    }
  };

  const inputs: EvaluationEntry['inputs'] = [];
  for (const path of [...paths].sort()) {
    let fp = '-';
    try {
      const s = statSync(path, { bigint: true });
      // Opening a directory is not reading its entries. Listing it is.
      if (s.isDirectory()) continue;
      if (changedDuringCall(s)) return changed(path);
      fp = describe(s);
    } catch {
      // Gone because the run removed what it wrote: absent is what it left.
      if (!written.has(path) && removedDuringCall(path)) return changed(path);
    }
    inputs.push([path, fp]);
  }

  const listings: EvaluationEntry['listings'] = [];
  for (const dir of [...dirs].sort()) {
    // Fingerprint before stat, so an entry added in between moves the mtime.
    const fp = listingFingerprint(dir);
    try {
      if (changedDuringCall(statSync(dir, { bigint: true })))
        return changed(dir);
    } catch {
      if (removedDuringCall(dir)) return changed(dir);
    }
    listings.push([dir, fp]);
  }
  return { inputs, listings };
}

/**
 * Reuses what an isolated plugin's worker answered when it loaded (its name,
 * hooks and createNodes pattern) while nothing it read or listed while loading
 * has changed, so a plugin whose hooks are all answered from cache never starts
 * a worker. Plugin caches are left out: they do not shape that answer.
 */
export class LoadResultCache<T> {
  private readonly cachePath: string;
  private readonly identity: string[];

  constructor(
    name: string,
    index: number | undefined,
    plugin: PluginConfiguration
  ) {
    this.identity = ['load', ...identityOf(name, index, plugin)];
    this.cachePath = join(CACHE_DIR, `${hashArray(this.identity)}.json`);
  }

  private key(): string {
    return hashArray([...this.identity, ...nxEnv()]);
  }

  lookup(): T | null {
    let entry: Fingerprints & { key: string; result: T };
    try {
      entry = readJsonFile(this.cachePath);
    } catch {
      return null;
    }
    return entry.key === this.key() && unchanged(this.identity[3], entry)
      ? entry.result
      : null;
  }

  store(result: T, trace: CallTrace, startedMs: number): void {
    const isPluginCache = (path: string) =>
      isUnder(path, workspaceDataDirectory) && !isWorkspaceIndex(path);
    const fingerprints = fingerprintTrace(
      this.identity[3],
      trace.reads.filter((p) => !isPluginCache(p)),
      trace.listings.filter((d) => !isUnder(d, workspaceDataDirectory)),
      new Set(trace.writes),
      startedMs
    );
    if (!fingerprints) return;
    mkdirSync(CACHE_DIR, { recursive: true });
    writeJsonFile(this.cachePath, { key: this.key(), ...fingerprints, result });
  }
}

export class EvaluationCache {
  private readonly cachePath: string;
  private readonly identity: string[];

  constructor(
    name: string,
    index: number | undefined,
    plugin: PluginConfiguration
  ) {
    this.identity = identityOf(name, index, plugin);
    this.cachePath = join(CACHE_DIR, `${hashArray(this.identity)}.json`);
  }

  private key(context: CreateNodesContext): string {
    return hashArray([
      ...this.identity,
      context.workspaceRoot,
      hashObject(context.nxJsonConfiguration ?? {}),
      ...nxEnv(),
    ]);
  }

  private async listingHash(
    workspaceRoot: string,
    configFiles: string[],
    results: CreateNodesResults
  ): Promise<string> {
    const roots = new Set<string>();
    for (const file of configFiles) roots.add(dirname(file));
    for (const [, , result] of results) {
      for (const root of Object.keys(result?.projects ?? {})) roots.add(root);
    }
    const patterns = [...roots]
      .sort()
      .map((r) => (r === '.' || r === '' ? '**/*' : `${r}/**/*`));
    const files = patterns.length
      ? await globWithWorkspaceContext(workspaceRoot, patterns)
      : [];
    return hashArray([...files].sort());
  }

  private readEntry(): (EvaluationEntry & { key: string }) | null {
    if (!existsSync(this.cachePath)) return null;
    try {
      return readJsonFile(this.cachePath);
    } catch {
      return null;
    }
  }

  /** Whether there are inputs to carry forward, or the next call must build them. */
  hasEntry(): boolean {
    return this.readEntry() !== null;
  }

  async lookup(
    configFiles: readonly string[],
    context: CreateNodesContext
  ): Promise<CreateNodesResults | null> {
    const entry = this.readEntry();
    if (!entry) return null;
    const files = [...configFiles].sort();
    if (entry.key !== this.key(context)) {
      logger.verbose(
        `[plugin-evaluation-cache] ${this.identity[2]}: nx.json, the plugin's options or the NX_ environment changed`
      );
      return null;
    }
    if (
      entry.configFiles.length !== files.length ||
      entry.configFiles.some((f, i) => f !== files[i])
    ) {
      logger.verbose(
        `[plugin-evaluation-cache] ${this.identity[2]}: the matched config files changed`
      );
      return null;
    }
    if (!unchanged(this.identity[2], entry)) {
      return null;
    }
    const listing = await this.listingHash(
      context.workspaceRoot,
      files,
      entry.results
    );
    if (listing !== entry.listingHash) {
      logger.verbose(
        `[plugin-evaluation-cache] ${this.identity[2]}: files were added or removed under a project root`
      );
      return null;
    }
    return entry.results;
  }

  async store(
    configFiles: readonly string[],
    context: CreateNodesContext,
    results: CreateNodesResults,
    trace: CallTrace,
    callStartedMs: number,
    bypassedPluginCaches: boolean
  ): Promise<void> {
    const previous = bypassedPluginCaches ? null : this.readEntry();
    if (!bypassedPluginCaches && !previous) {
      // Nothing to carry forward, and plugin caches may have skipped reads.
      return;
    }
    const paths = new Set<string>();
    for (const path of trace.reads) {
      if (isUnder(path, workspaceDataDirectory) && !isWorkspaceIndex(path)) {
        if (bypassedPluginCaches) {
          // Read with plugin caches off: a cache that ignores the switch, such
          // as gradle's or maven's, so this plugin's reads are never complete.
          logger.verbose(
            `[plugin-evaluation-cache] not caching: the plugin read ${path} with plugin caches off`
          );
          return;
        }
        continue;
      }
      paths.add(path);
    }
    for (const [path] of previous?.inputs ?? []) paths.add(path);

    const dirs = new Set<string>();
    for (const dir of trace.listings) {
      // Plugin caches list their own directory as they rewrite it.
      if (!isUnder(dir, workspaceDataDirectory)) dirs.add(dir);
    }
    for (const [dir] of previous?.listings ?? []) dirs.add(dir);

    const fingerprints = fingerprintTrace(
      this.identity[2],
      paths,
      dirs,
      new Set(trace.writes),
      callStartedMs
    );
    if (!fingerprints) return;
    const files = [...configFiles].sort();
    const entry: EvaluationEntry & { key: string } = {
      key: this.key(context),
      configFiles: files,
      listingHash: await this.listingHash(
        context.workspaceRoot,
        files,
        results
      ),
      ...fingerprints,
      results,
    };
    mkdirSync(CACHE_DIR, { recursive: true });
    writeJsonFile(this.cachePath, entry);
  }
}
