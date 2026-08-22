import { join } from 'node:path';
import type { ProjectGraph } from '../../config/project-graph';
import { EventType, hashFile, type WatchEvent } from '../../native';
import { workspaceRoot } from '../../utils/workspace-root';

// Last-seen content hash per dotenv file, so a byte-identical rewrite (an editor
// save that changes nothing) does not invalidate the graph cache.
const dotEnvFileHashes = new Map<string, string>();

// getEnvPathsForTask loads `.env`, `.env.local`, `.local.env` and the
// target-scoped `.env.<id>[.local]` / `.<id>[.local].env` variants. The `<id>`
// (a target or configuration name) may itself contain `/`, so the name is
// matched relative to the owning root rather than by basename.
const DOTENV_PREFIXED = /^\.env(\..+)?$/;
const DOTENV_SUFFIXED = /^\..+\.env$/;

function isDotEnvName(name: string): boolean {
  return DOTENV_PREFIXED.test(name) || DOTENV_SUFFIXED.test(name);
}

export interface DotEnvChangeClassification {
  invalidating: string[];
  unclassified: WatchEvent[];
}

/**
 * Splits the change events into `invalidating`: the paths with the dotenv name
 * shape getEnvPathsForTask loads (`.env[.<id>]` / `.<id>.env` variants), under
 * the workspace root or a project root, whose content actually changed; and
 * `unclassified`: the dotenv-shaped events under no known root. The
 * invalidating names are a superset of what any task loads: target and
 * configuration names are unknown here, so `.env.staging` is reported whether
 * or not a task loads it. The daemon uses this to refresh its graph cache so
 * createNodes re-resolves config that reads process.env.
 *
 * Only the workspace root and project roots invalidate: getEnvPathsForTask
 * loads dotenv files from those, never from an arbitrary subdirectory (e.g. one
 * under node_modules), and the outputs watcher spans the whole workspace root.
 * An unclassified event is not necessarily irrelevant, though: the graph it was
 * classified against can predate the file's project root (none is committed
 * during the initial computation, and a replaced graph lacks a project that
 * computation is adding), so the caller queues it for replay against the next
 * graph a computation is about to serve rather than dropping it.
 *
 * Known limitation: a `.nxignore`d dotenv file never reaches this watcher (the
 * native watcher applies `.nxignore` even with `use_ignore: false`), so a warm
 * edit of one does not invalidate the graph. The cold path still resolves it:
 * getGraphTimeDotEnvForTask reads dotenv from disk directly.
 */
export function classifyDotEnvChanges(
  changeEvents: WatchEvent[],
  projectGraph: ProjectGraph | undefined
): DotEnvChangeClassification {
  // Outputs batches rarely touch dotenv files, so the O(projects) roots set is
  // only built once a path clears this superset-of-dotenv-names check.
  const candidates = changeEvents.filter((event) =>
    mayBeDotEnvPath(event.path)
  );
  if (candidates.length === 0) {
    return { invalidating: [], unclassified: [] };
  }

  const roots = graphTimeDotEnvRoots(projectGraph);
  const invalidating: string[] = [];
  const unclassified: WatchEvent[] = [];

  for (const event of candidates) {
    const { path, type } = event;
    if (!isDotEnvUnderRoot(path, roots)) {
      // A recorded hash stops being proof the graph observed the current
      // content once an event for the path cannot be classified: the pending
      // replay can drop it, and a later classified event with the same bytes
      // would then be suppressed as an unchanged rewrite over a graph that
      // observed a different state (e.g. the file's absence).
      dotEnvFileHashes.delete(path);
      unclassified.push(event);
      continue;
    }

    if (type === EventType.delete) {
      // A removed dotenv file drops the vars it set, so the config resolves
      // differently; there is no content to hash.
      dotEnvFileHashes.delete(path);
      invalidating.push(path);
      continue;
    }

    const hash = hashFile(join(workspaceRoot, path));
    if (hash !== null && dotEnvFileHashes.get(path) === hash) {
      continue;
    }
    // hashFile returns null on a vanished/unreadable file; when we cannot prove
    // the content is unchanged, report the path rather than risk a stale graph.
    if (hash !== null) {
      dotEnvFileHashes.set(path, hash);
    } else {
      dotEnvFileHashes.delete(path);
    }
    invalidating.push(path);
  }

  return { invalidating, unclassified };
}

// Superset of the names both regexes accept: a prefixed name's first segment
// starts with `.env` and a suffixed name's last segment ends with `.env`, even
// when the target/configuration identifier contains `/`.
function mayBeDotEnvPath(path: string): boolean {
  // Nearly every outputs path lacks the substring, so check it before the
  // per-segment split: this runs for every path in every outputs batch.
  if (!path.includes('.env')) {
    return false;
  }
  return path
    .split('/')
    .some((segment) => segment.startsWith('.env') || segment.endsWith('.env'));
}

function graphTimeDotEnvRoots(
  projectGraph: ProjectGraph | undefined
): Set<string> {
  const roots = new Set<string>(['.']);
  if (projectGraph) {
    for (const node of Object.values(projectGraph.nodes)) {
      roots.add(node.data.root);
    }
  }
  return roots;
}

/**
 * Whether `path` is a dotenv file that getEnvPathsForTask would load from the
 * workspace root or a project root. For a project root, the name relative to
 * the root may contain `/` because a target/configuration identifier can, and
 * every root ancestor is tried, so a nested project root does not shadow a
 * parent's slash-identifier dotenv. At the workspace root, only
 * single-segment names match.
 */
function isDotEnvUnderRoot(path: string, roots: Set<string>): boolean {
  for (
    let slash = path.lastIndexOf('/');
    slash > 0;
    slash = path.lastIndexOf('/', slash - 1)
  ) {
    const dir = path.slice(0, slash);
    // Keep walking past a closer root that yields no dotenv name: the same path
    // can still be a slash-identifier dotenv for a shallower (parent) root.
    if (roots.has(dir) && isDotEnvName(path.slice(slash + 1))) {
      return true;
    }
  }
  // No project-root ancestor: a workspace-root dotenv, single-segment names
  // only. A deeper path (e.g. `.github/workflows/ci.env`) has the dotenv name
  // shape only for a target identifier containing `/`; accepting those would
  // invalidate on every write under such dot-directories.
  return roots.has('.') && !path.includes('/') && isDotEnvName(path);
}

// Paths of dotenv-shaped events whose graph refresh is not provably scheduled:
// paths under no known root on arrival (the next graph may know the root) and
// edits to tracked files (the workspace watcher schedules the refresh, but a
// computation already in flight may have read the file before the edit). Each
// maps to the recomputation generation current at queue time, so the pre-serve
// replay can prove whether a computation started before the event arrived.
const pendingDotEnvEvents = new Map<string, number>();
// Bounds daemon-lived growth when nothing drains for a long time. The
// generation current when the last event was lost stands in for the lost
// stamps, so overflow follows the same freshness rule as a queued entry.
const MAX_PENDING_DOTENV_EVENTS = 1024;
let pendingDotEnvEventsOverflowedAtGeneration: number | undefined;

/**
 * `generation` is the recomputation generation current at queue time; the
 * drain compares it against the serving computation's generation to prove
 * whether that computation started before the event arrived.
 */
export function queuePendingDotEnvEvents(
  paths: string[],
  generation: number
): void {
  for (const path of paths) {
    if (
      pendingDotEnvEvents.size >= MAX_PENDING_DOTENV_EVENTS &&
      !pendingDotEnvEvents.has(path)
    ) {
      pendingDotEnvEventsOverflowedAtGeneration = generation;
      // A lost path never reaches a drain, so its recorded hash would outlive
      // the queue's deletion discipline and could suppress a later event over
      // a graph that observed different bytes. Drop it while the identity is
      // still known.
      dotEnvFileHashes.delete(path);
    } else {
      pendingDotEnvEvents.set(path, generation);
    }
  }
}

/**
 * Takes and clears the queued unclassified events, returning the paths that
 * are dotenv files under a root of `projectGraph` and were queued at or after
 * `sinceGeneration` (the serving computation's generation). A path queued
 * earlier is dropped safely: the computation claimed its generation after the
 * event was queued, so it read the file after the edit landed. Content hashes
 * are neither consulted nor recorded here, and any hash recorded for a
 * drained path is dropped: a hash taken mid-computation is not proof any
 * served graph observed those bytes (the computation may read intermediate
 * content), so suppressing a later event on it could leave the graph stale.
 * `overflowed` means events were lost at or after `sinceGeneration`, so the
 * caller cannot prove its graph fresh and must invalidate; an overflow
 * recorded earlier is dropped by the same rule as a queued entry. A relevant
 * overflow also drops every recorded hash: with events lost, a retained hash
 * (even for a path that invalidated directly and never entered the queue)
 * could suppress a later event over intermediate bytes read by the successor
 * this drain forces. That successor is already being forced, so clearing
 * adds no recomputation.
 *
 * A stamp records callback time, not edit time, so an event whose edit a
 * workspace-watcher-triggered computation already observed can still
 * invalidate it: one redundant recompute, accepted because the callback
 * cannot prove which side of that computation's file read the edit landed on.
 */
export function drainPendingDotEnvEvents(
  projectGraph: ProjectGraph | undefined,
  sinceGeneration: number
): { invalidating: string[]; overflowed: boolean } {
  const entries = Array.from(pendingDotEnvEvents.entries());
  const overflowed =
    pendingDotEnvEventsOverflowedAtGeneration !== undefined &&
    pendingDotEnvEventsOverflowedAtGeneration >= sinceGeneration;
  pendingDotEnvEvents.clear();
  pendingDotEnvEventsOverflowedAtGeneration = undefined;
  if (overflowed) {
    dotEnvFileHashes.clear();
  }
  if (entries.length === 0) {
    return { invalidating: [], overflowed };
  }
  const roots = graphTimeDotEnvRoots(projectGraph);
  const invalidating: string[] = [];
  for (const [path, generation] of entries) {
    dotEnvFileHashes.delete(path);
    if (generation >= sinceGeneration && isDotEnvUnderRoot(path, roots)) {
      invalidating.push(path);
    }
  }
  return { invalidating, overflowed };
}

/**
 * Whether the queue holds evidence that a computation at `sinceGeneration`
 * may have read a dotenv file before a reported edit landed: an entry or an
 * overflow stamped at or after that generation. Consumes nothing and
 * classifies against no roots: the error paths use this to decide on a retry,
 * where there may be no graph to classify against, and a spurious retry costs
 * one recompute on an already failing path. A persistent error retries once,
 * because the retry's successor claims a generation above every stamp
 * recorded so far.
 */
export function hasPendingDotEnvEvidence(sinceGeneration: number): boolean {
  if (
    pendingDotEnvEventsOverflowedAtGeneration !== undefined &&
    pendingDotEnvEventsOverflowedAtGeneration >= sinceGeneration
  ) {
    return true;
  }
  for (const generation of pendingDotEnvEvents.values()) {
    if (generation >= sinceGeneration) {
      return true;
    }
  }
  return false;
}

/**
 * Like hasPendingDotEnvEvidence, but classifies each entry against the roots
 * of `projectGraph`: evidence is an overflow stamped at or after
 * `sinceGeneration`, or an entry so stamped whose path is a dotenv file under
 * one of the graph's roots. The warm-reuse check uses this, where the graph
 * the cache serves exists and is exactly what a recompute would refresh;
 * skipping paths under none of its roots avoids recomputing for events only
 * a future graph could classify, and consuming nothing leaves those entries
 * queued for that computation's drain.
 */
export function hasRelevantPendingDotEnvEvidence(
  projectGraph: ProjectGraph | undefined,
  sinceGeneration: number
): boolean {
  if (
    pendingDotEnvEventsOverflowedAtGeneration !== undefined &&
    pendingDotEnvEventsOverflowedAtGeneration >= sinceGeneration
  ) {
    return true;
  }
  let roots: Set<string> | undefined;
  for (const [path, generation] of pendingDotEnvEvents) {
    if (generation < sinceGeneration) {
      continue;
    }
    if (!roots) {
      roots = graphTimeDotEnvRoots(projectGraph);
    }
    if (isDotEnvUnderRoot(path, roots)) {
      return true;
    }
  }
  return false;
}

/**
 * Drops every recorded content hash. The error-path retry and the warm-reuse
 * check force a successor while preserving the queue for its drain, but a
 * recorded hash is not proof the graph that successor serves observed those
 * bytes; kept, it could suppress a callback that lands while the successor
 * reads.
 */
export function clearDotEnvFileHashes(): void {
  dotEnvFileHashes.clear();
}

// Test helper: the queue is daemon-lived module state.
export function _resetPendingDotEnvEvents(): void {
  pendingDotEnvEvents.clear();
  pendingDotEnvEventsOverflowedAtGeneration = undefined;
}
