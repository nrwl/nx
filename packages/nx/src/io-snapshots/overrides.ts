import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { NxJsonConfiguration } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { Task, TaskGraph } from '../config/task-graph';
import type { IoSnapshotOverride, IoSnapshotResolution } from '../native';
import { readProjectsConfigurationFromProjectGraph } from '../project-graph/project-graph';
import { getCustomHasher } from '../tasks-runner/utils';
import { getLatestCommitSha } from '../utils/git-utils';
import { ioSnapshotsCacheDirectory, isIoSnapshotFetchEnabled } from './fetch';

export type { IoSnapshotOverride, IoSnapshotResolution } from '../native';

export type IoSnapshotDiagnostic =
  /** Nothing cached for HEAD: not connected, flag off, or never fetched. */
  | { reason: 'no-bundle' }
  | { reason: 'invalid-bundle'; file: string; message: string }
  | { reason: 'manual'; taskId: string }
  | { reason: 'custom-hasher'; taskId: string }
  /** The bundle has no entry for the task. */
  | { reason: 'missing'; taskId: string }
  /** Interim flat entry; reads are not classified, so no override is built. */
  | { reason: 'unclassified'; taskId: string }
  | { reason: 'unknown-project'; taskId: string; project: string }
  | { reason: 'producer-not-in-graph'; taskId: string; producer: string };

export interface IoSnapshotOverridesResult {
  overrides: Record<string, IoSnapshotOverride>;
  diagnostics: IoSnapshotDiagnostic[];
  resolution: IoSnapshotResolution | null;
}

interface StructuredInputs {
  projects?: Record<string, string[]>;
  workspace?: string[];
  taskOutputs?: Record<string, string[]>;
}

interface BundleEntry {
  commit: string;
  inputs: string[] | StructuredInputs;
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
  nxJson: NxJsonConfiguration
): IoSnapshotOverridesResult | null {
  if (!isIoSnapshotFetchEnabled(nxJson)) {
    return null;
  }
  const diagnostics: IoSnapshotDiagnostic[] = [];
  const overrides: Record<string, IoSnapshotOverride> = {};

  const bundle = readBundleForHead(diagnostics);
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
    if (target?.cache === 'manual') {
      diagnostics.push({ reason: 'manual', taskId: task.id });
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
    if (Array.isArray(entry.inputs)) {
      diagnostics.push({ reason: 'unclassified', taskId: task.id });
      continue;
    }
    const override = toOverride(
      task,
      entry.inputs,
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
  inputs: StructuredInputs,
  digest: string,
  projectGraph: ProjectGraph,
  taskGraph: TaskGraph,
  diagnostics: IoSnapshotDiagnostic[]
): IoSnapshotOverride | null {
  const projects: Record<string, string[]> = {};
  for (const [project, globs] of Object.entries(inputs.projects ?? {})) {
    const node = projectGraph.nodes[project];
    if (!node) {
      diagnostics.push({ reason: 'unknown-project', taskId: task.id, project });
      return null;
    }
    // The bundle stores project-relative globs; ProjectFileSet patterns are
    // workspace-relative.
    const prefix = node.data.root === '.' ? '' : `${node.data.root}/`;
    projects[project] = globs.map((glob) =>
      glob.startsWith('!') ? `!${prefix}${glob.slice(1)}` : `${prefix}${glob}`
    );
  }
  const taskOutputs: Record<string, string[]> = {};
  for (const [producer, paths] of Object.entries(inputs.taskOutputs ?? {})) {
    if (!taskGraph.tasks[producer]) {
      diagnostics.push({
        reason: 'producer-not-in-graph',
        taskId: task.id,
        producer,
      });
      return null;
    }
    taskOutputs[producer] = [...paths];
  }
  return {
    projects,
    workspace: [...(inputs.workspace ?? [])],
    taskOutputs,
    digest,
  };
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
  const file = join(ioSnapshotsCacheDirectory, head, IO_SNAPSHOT_BUNDLE_FILE);
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
