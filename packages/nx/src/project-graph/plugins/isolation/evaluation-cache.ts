import {
  type BigIntStats,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
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
 *   the plugin and during the call, by fingerprint.
 */

type CreateNodesResults = Array<
  readonly [plugin: string, file: string, result: CreateNodesResult]
>;

interface EvaluationEntry {
  configFiles: string[];
  listingHash: string;
  inputs: Array<[path: string, fingerprint: string]>;
  results: CreateNodesResults;
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

function describe(s: BigIntStats): string {
  return `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
}

function fingerprint(path: string): string {
  try {
    return describe(statSync(path, { bigint: true }));
  } catch {
    return '-';
  }
}

// nx's own state: the temp root (node's compile cache, native binding copies,
// re-signed binaries) and ~/.nx (its database). Derived from inputs already
// recorded, and rewritten as nx runs.
const derivedDirs = [NX_TMP_DIR, join(homedir(), '.nx')].flatMap((dir) => [
  dir,
  canonicalDir(dir),
]);

/** Files that change for reasons unrelated to what a plugin computes. */
function isNoise(path: string): boolean {
  if (derivedDirs.some((dir) => isUnder(path, dir))) {
    return true;
  }
  return (
    process.platform !== 'win32' &&
    (path.startsWith('/dev/') ||
      path.startsWith('/proc/') ||
      path.startsWith('/sys/'))
  );
}

/**
 * The reads attributed to one call: everything before the first call marker,
 * which is the worker loading the plugin, plus everything between this call's
 * markers. `null` when the trace cannot be trusted to be complete.
 */
export function readCallTrace(
  markers: TraceMarkers,
  traceId: string
): string[] | null {
  let lines: string[];
  try {
    lines = readFileSync(markers.logPath, 'utf8').split('\n');
  } catch {
    return null;
  }
  const reads = new Set<string>();
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
      if (line === `!begin ${traceId}`) phase = 'call';
      else if (phase === 'load') phase = 'other';
      continue;
    }
    if (line.startsWith('!end ')) {
      if (line === `!end ${traceId}`) phase = 'done';
      continue;
    }
    if (phase === 'load' || phase === 'call') {
      const path = resolve(line);
      if (samePath(path, markers.workerScript)) sawWorkerScript = true;
      if (!isNoise(path)) reads.add(path);
    }
  }
  return sawWorkerScript && phase === 'done' ? [...reads] : null;
}

export class EvaluationCache {
  private readonly cachePath: string;
  private readonly identity: string[];

  constructor(
    name: string,
    index: number | undefined,
    plugin: PluginConfiguration
  ) {
    const config = typeof plugin === 'string' ? { plugin } : plugin;
    this.identity = [
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
    this.cachePath = join(CACHE_DIR, `${hashArray(this.identity)}.json`);
  }

  private key(context: CreateNodesContext): string {
    const nxEnv = Object.keys(process.env)
      .filter((k) => k.startsWith('NX_'))
      .sort()
      .map((k) => `${k}=${process.env[k]}`);
    return hashArray([
      ...this.identity,
      context.workspaceRoot,
      hashObject(context.nxJsonConfiguration ?? {}),
      ...nxEnv,
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

  async lookup(
    configFiles: readonly string[],
    context: CreateNodesContext
  ): Promise<CreateNodesResults | null> {
    if (!existsSync(this.cachePath)) return null;
    let entry: EvaluationEntry & { key: string };
    try {
      entry = readJsonFile(this.cachePath);
    } catch {
      return null;
    }
    const files = [...configFiles].sort();
    if (
      entry.key !== this.key(context) ||
      entry.configFiles.length !== files.length ||
      entry.configFiles.some((f, i) => f !== files[i])
    ) {
      return null;
    }
    for (const [path, fp] of entry.inputs) {
      if (fingerprint(path) !== fp) {
        logger.verbose(`[plugin-evaluation-cache] ${path} changed`);
        return null;
      }
    }
    const listing = await this.listingHash(
      context.workspaceRoot,
      files,
      entry.results
    );
    return listing === entry.listingHash ? entry.results : null;
  }

  async store(
    configFiles: readonly string[],
    context: CreateNodesContext,
    results: CreateNodesResults,
    reads: string[],
    callStartedMs: number
  ): Promise<void> {
    const startedNs = BigInt(Math.floor(callStartedMs * 1_000_000));
    const inputs: EvaluationEntry['inputs'] = [];
    for (const path of reads.sort()) {
      // A plugin that reads its own cache can return results without reading
      // what they came from, so its trace does not cover them.
      if (isUnder(path, workspaceDataDirectory)) {
        logger.verbose(
          `[plugin-evaluation-cache] not caching: the plugin read ${path}`
        );
        return;
      }
      let fp = '-';
      try {
        const s = statSync(path, { bigint: true });
        // Opening a directory is not reading content. Listings are covered
        // by the config files and project root listings instead.
        if (s.isDirectory()) continue;
        // Written during the call: the result may reflect either version.
        if (s.mtimeNs >= startedNs || s.ctimeNs >= startedNs) return;
        fp = describe(s);
      } catch {
        // Read during the call and gone now: recorded as absent.
      }
      inputs.push([path, fp]);
    }
    const files = [...configFiles].sort();
    const entry: EvaluationEntry & { key: string } = {
      key: this.key(context),
      configFiles: files,
      listingHash: await this.listingHash(
        context.workspaceRoot,
        files,
        results
      ),
      inputs,
      results,
    };
    mkdirSync(CACHE_DIR, { recursive: true });
    writeJsonFile(this.cachePath, entry);
  }
}
