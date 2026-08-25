import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import {
  checkFilesGlobs,
  type IoSnapshotOverride,
  type IoSnapshotResolution,
} from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getCustomHasher } from '../tasks-runner/utils';
import { getLatestCommitSha } from '../utils/git-utils';
import { ioSnapshotsCacheDirectory, isIoSnapshotFetchEnabled } from './fetch';

export type { IoSnapshotOverride, IoSnapshotResolution } from '../native';

export type IoSnapshotDiagnostic =
  /** Nothing cached for HEAD: not connected, flag off, or never fetched. */
  | { reason: 'no-bundle' }
  | { reason: 'invalid-bundle'; file: string; message: string }
  /** The target opted out with `ioSnapshots: false`. */
  | { reason: 'disabled'; taskId: string }
  | { reason: 'custom-hasher'; taskId: string }
  /** The bundle has no entry for the task. */
  | { reason: 'missing'; taskId: string }
  /** A legacy per-project bucket named a project not in the graph; the bucket is skipped. */
  | { reason: 'unknown-project'; taskId: string; project: string }
  /** A glob with no literal leading directory would walk the whole workspace. */
  | { reason: 'root-anchored-glob'; taskId: string; glob: string }
  | { reason: 'producer-not-in-graph'; taskId: string; producer: string };

export interface IoSnapshotOverridesResult {
  overrides: Record<string, IoSnapshotOverride>;
  diagnostics: IoSnapshotDiagnostic[];
  resolution: IoSnapshotResolution | null;
}

/** Pre-§2b bundles bucketed reads by project; accepted for one release. */
interface LegacyStructuredInputs {
  projects?: Record<string, string[]>;
  workspace?: string[];
  taskOutputs?: Record<string, string[]>;
}

interface BundleEntry {
  commit: string;
  /** Workspace-relative collapsed globs; `!` negations pass through. */
  inputs: string[] | LegacyStructuredInputs;
  taskOutputs?: Record<string, string[]>;
  outputs: string[];
}

interface Bundle {
  version: number;
  resolution: IoSnapshotResolution;
  snapshots: Record<string, BundleEntry>;
}

export const IO_SNAPSHOT_BUNDLE_FILE = 'snapshots.json';
const BUNDLE_VERSION = 1;

/**
 * The one reader of the fetched snapshot bundle (NXC-4846). Lifts
 * `<cacheDir>/io-snapshots/<HEAD>/snapshots.json` into per-task planner
 * overrides. Never fetches and never throws. Returns `null` when snapshots
 * are off for this workspace; callers treat `null` and `{ overrides: {} }`
 * identically for hashing.
 */
export function buildIoSnapshotOverrides(
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  /**
   * A specific bundle directory (the one the client fetched for its HEAD).
   * Skips the enablement gate and HEAD lookup, so the daemon hashes exactly
   * what the client resolved.
   */
  bundleDir?: string
): IoSnapshotOverridesResult | null {
  if (!bundleDir && !isIoSnapshotFetchEnabled(nxJson)) {
    return null;
  }
  const diagnostics: IoSnapshotDiagnostic[] = [];
  const overrides: Record<string, IoSnapshotOverride> = {};

  const bundle = bundleDir
    ? readBundle(join(bundleDir, IO_SNAPSHOT_BUNDLE_FILE), diagnostics)
    : readBundleForHead(diagnostics);
  if (!bundle) {
    return { overrides, diagnostics, resolution: null };
  }

  const projects =
    readProjectsConfigurationFromProjectGraph(projectGraph).projects;
  for (const task of Object.values(taskGraph.tasks)) {
    const target =
      projectGraph.nodes[task.target.project]?.data.targets?.[
        task.target.target
      ];
    if (target?.ioSnapshots === false) {
      diagnostics.push({ reason: 'disabled', taskId: task.id });
      continue;
    }
    if (hasCustomHasher(task, projects)) {
      diagnostics.push({ reason: 'custom-hasher', taskId: task.id });
      continue;
    }
    const entry = bundle.snapshots[task.id];
    if (!entry) {
      diagnostics.push({ reason: 'missing', taskId: task.id });
      continue;
    }
    const override = toOverride(
      task,
      entry,
      bundle.resolution.digest,
      projectGraph,
      taskGraph,
      diagnostics
    );
    if (override) {
      overrides[task.id] = override;
    }
  }

  return { overrides, diagnostics, resolution: bundle.resolution };
}

function toOverride(
  task: Task,
  entry: BundleEntry,
  digest: string,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  diagnostics: IoSnapshotDiagnostic[]
): IoSnapshotOverride | null {
  const files = new Set<string>();
  let taskOutputs: Record<string, string[]>;
  if (Array.isArray(entry.inputs)) {
    entry.inputs.forEach((glob) => files.add(glob));
    taskOutputs = entry.taskOutputs ?? {};
  } else {
    // Legacy bucketed form: project globs are project-relative.
    for (const [project, globs] of Object.entries(
      entry.inputs.projects ?? {}
    )) {
      const node = projectGraph.nodes[project];
      if (!node) {
        diagnostics.push({
          reason: 'unknown-project',
          taskId: task.id,
          project,
        });
        continue;
      }
      const prefix = node.data.root === '.' ? '' : `${node.data.root}/`;
      for (const glob of globs) {
        files.add(
          glob.startsWith('!')
            ? `!${prefix}${glob.slice(1)}`
            : `${prefix}${glob}`
        );
      }
    }
    (entry.inputs.workspace ?? []).forEach((glob) => files.add(glob));
    taskOutputs = entry.inputs.taskOutputs ?? entry.taskOutputs ?? {};
  }

  const scheduled: Record<string, string[]> = {};
  for (const [producer, paths] of Object.entries(taskOutputs)) {
    if (!taskGraph.tasks[producer]) {
      diagnostics.push({
        reason: 'producer-not-in-graph',
        taskId: task.id,
        producer,
      });
      return null;
    }
    scheduled[producer] = [...paths].sort();
    // Output reads are hashed from disk like any other read; the producer
    // entry only orders this task after them.
    paths.forEach((path) => files.add(path));
  }

  const sorted = [...files].sort();
  const rootAnchored = checkFilesGlobs(sorted);
  if (rootAnchored) {
    diagnostics.push({
      reason: 'root-anchored-glob',
      taskId: task.id,
      glob: rootAnchored,
    });
    return null;
  }
  return { files: sorted, taskOutputs: scheduled, digest };
}

function hasCustomHasher(
  task: Task,
  projects: ReturnType<
    typeof readProjectsConfigurationFromProjectGraph
  >['projects']
): boolean {
  try {
    return !!getCustomHasher(task, projects);
  } catch {
    // An unresolvable executor fails later, at execution; it is not a reason
    // to withhold a snapshot here.
    return false;
  }
}

let cachedBundle: { file: string; mtimeMs: number; bundle: Bundle } | null =
  null;

// Long-lived callers (the daemon) re-read only when the file changes.
function readBundleForHead(diagnostics: IoSnapshotDiagnostic[]): Bundle | null {
  const head = getLatestCommitSha();
  if (!head) {
    diagnostics.push({ reason: 'no-bundle' });
    return null;
  }
  return readBundle(
    join(ioSnapshotsCacheDirectory, head, IO_SNAPSHOT_BUNDLE_FILE),
    diagnostics
  );
}

function readBundle(
  file: string,
  diagnostics: IoSnapshotDiagnostic[]
): Bundle | null {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    diagnostics.push({ reason: 'no-bundle' });
    return null;
  }
  if (cachedBundle?.file === file && cachedBundle.mtimeMs === mtimeMs) {
    return cachedBundle.bundle;
  }
  try {
    const bundle = JSON.parse(readFileSync(file, 'utf8')) as Bundle;
    if (
      bundle?.version !== BUNDLE_VERSION ||
      typeof bundle.resolution?.digest !== 'string' ||
      typeof bundle.snapshots !== 'object' ||
      bundle.snapshots === null
    ) {
      throw new Error(`not a version ${BUNDLE_VERSION} snapshot bundle`);
    }
    cachedBundle = { file, mtimeMs, bundle };
    return bundle;
  } catch (e) {
    diagnostics.push({
      reason: 'invalid-bundle',
      file,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** @internal test hook */
export function _resetIoSnapshotBundleCache(): void {
  cachedBundle = null;
}
