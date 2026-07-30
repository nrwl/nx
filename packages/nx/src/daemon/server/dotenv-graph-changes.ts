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
 * Whether any change event touches a dotenv file that a task chain would load
 * with content that actually changed. The daemon uses this to invalidate its
 * graph cache so createNodes re-resolves config that reads process.env.
 *
 * Only the workspace root and project roots are considered: getEnvPathsForTask
 * loads dotenv files from those, never from an arbitrary subdirectory (e.g. one
 * under node_modules), and the outputs watcher spans the whole workspace root.
 *
 * Known limitation: a `.nxignore`d dotenv file never reaches this watcher (the
 * native watcher applies `.nxignore` even with `use_ignore: false`), so a warm
 * edit of one does not invalidate the graph. The cold path still resolves it:
 * getGraphTimeEnvForTask reads dotenv from disk directly.
 */
export function outputsChangeInvalidatesGraphEnv(
  changeEvents: WatchEvent[],
  projectGraph: ProjectGraph | undefined
): boolean {
  const roots = graphTimeDotEnvRoots(projectGraph);
  let invalidate = false;

  for (const { path, type } of changeEvents) {
    if (dotEnvNameUnderRoot(path, roots) === null) {
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
 * If `path` is a dotenv file that getEnvPathsForTask would load from the
 * workspace root or a project root, returns its name relative to that root;
 * otherwise null. The deepest matching root wins (nested projects), and the
 * relative name may contain `/` because a target/configuration identifier can.
 */
function dotEnvNameUnderRoot(path: string, roots: Set<string>): string | null {
  for (
    let slash = path.lastIndexOf('/');
    slash > 0;
    slash = path.lastIndexOf('/', slash - 1)
  ) {
    const dir = path.slice(0, slash);
    // A root closer to the file is checked first, but a non-match there must
    // keep walking: the same path can be a slash-identifier dotenv for a
    // shallower (parent) root.
    if (roots.has(dir)) {
      const name = path.slice(slash + 1);
      if (isDotEnvName(name)) {
        return name;
      }
    }
  }
  // No project-root ancestor: treat as a workspace-root-relative path.
  return roots.has('.') && isDotEnvName(path) ? path : null;
}

// Test helper: the hash map is daemon-lived module state.
export function _resetDotEnvFileHashes(): void {
  dotEnvFileHashes.clear();
}
