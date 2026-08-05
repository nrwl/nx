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

/**
 * Whether any change event touches a file with the dotenv name shape
 * getEnvPathsForTask loads (`.env[.<id>]` / `.<id>.env` variants) whose content
 * actually changed. The names are a superset of what any task loads: target and
 * configuration names are unknown here, so `.env.staging` invalidates whether
 * or not a task loads it. The daemon uses this to invalidate its graph cache so
 * createNodes re-resolves config that reads process.env.
 *
 * Only the workspace root and project roots are considered: getEnvPathsForTask
 * loads dotenv files from those, never from an arbitrary subdirectory (e.g. one
 * under node_modules), and the outputs watcher spans the whole workspace root.
 *
 * Known limitation: a `.nxignore`d dotenv file never reaches this watcher (the
 * native watcher applies `.nxignore` even with `use_ignore: false`), so a warm
 * edit of one does not invalidate the graph. The cold path still resolves it:
 * getGraphTimeDotEnvForTask reads dotenv from disk directly.
 */
export function outputsChangeInvalidatesGraphEnv(
  changeEvents: WatchEvent[],
  projectGraph: ProjectGraph | undefined
): boolean {
  // Outputs batches rarely touch dotenv files, so the O(projects) roots set is
  // only built once a path clears this superset-of-dotenv-names check.
  const candidates = changeEvents.filter((event) =>
    mayBeDotEnvPath(event.path)
  );
  if (candidates.length === 0) {
    return false;
  }

  const roots = graphTimeDotEnvRoots(projectGraph);
  let invalidate = false;

  for (const { path, type } of candidates) {
    if (!isDotEnvUnderRoot(path, roots)) {
      continue;
    }

    if (type === EventType.delete) {
      // A removed dotenv file drops the vars it set, so the config resolves
      // differently; there is no content to hash.
      dotEnvFileHashes.delete(path);
      invalidate = true;
      continue;
    }

    const hash = hashFile(join(workspaceRoot, path));
    if (hash !== null && dotEnvFileHashes.get(path) === hash) {
      continue;
    }
    // hashFile returns null on a vanished/unreadable file; when we cannot prove
    // the content is unchanged, invalidate rather than risk a stale graph.
    if (hash !== null) {
      dotEnvFileHashes.set(path, hash);
    } else {
      dotEnvFileHashes.delete(path);
    }
    invalidate = true;
  }

  return invalidate;
}

// Superset of the names both regexes accept: a prefixed name's first segment
// starts with `.env` and a suffixed name's last segment ends with `.env`, even
// when the target/configuration identifier contains `/`.
function mayBeDotEnvPath(path: string): boolean {
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
 * workspace root or a project root. The name relative to the root may contain
 * `/` because a target/configuration identifier can, and every root ancestor is
 * tried, so a nested project root does not shadow a parent's slash-identifier
 * dotenv.
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
  // only. A deeper path (`.nx/cache/abc.env`, `.github/workflows/ci.env`) has
  // the dotenv name shape only for a target identifier containing `/`;
  // accepting those would invalidate on every write under such dot-directories.
  return roots.has('.') && !path.includes('/') && isDotEnvName(path);
}

// Test helper: the hash map is daemon-lived module state.
export function _resetDotEnvFileHashes(): void {
  dotEnvFileHashes.clear();
}
