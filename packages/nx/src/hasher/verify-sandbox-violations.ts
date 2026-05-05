import { minimatch } from 'minimatch';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { HashInputs } from '../native';
import { getOutputsForTargetAndConfiguration } from '../tasks-runner/utils';
import { splitTargetFromNodes } from '../utils/split-target';
import { workspaceRoot as defaultWorkspaceRoot } from '../utils/workspace-root';
import { HashPlanInspector } from './hash-plan-inspector';

/**
 * A single sandbox violation report produced by a prior task run.
 * All paths must be workspace-relative POSIX paths (forward slashes, no
 * leading slash). The verifier does not normalise paths — callers must ensure
 * consistency with how Nx records file paths in its own data structures.
 */
export interface SandboxViolationInput {
  /** Full Nx task ID, e.g. `"myproj:build"` or `"myproj:build:production"`. */
  taskId: string;
  /** Workspace-relative POSIX paths that were read outside the sandbox. */
  reads?: string[];
  /** Workspace-relative POSIX paths that were written outside the sandbox. */
  writes?: string[];
}

/**
 * The reconciliation result for a single sandbox violation.
 */
export interface SandboxViolationResult {
  /** The task ID from the original {@link SandboxViolationInput}. */
  taskId: string;
  reads: {
    /** Paths that are legitimate declared inputs for this task. */
    reconciled: string[];
    /** Paths that are still not covered by any declared input. */
    stillUnexpected: string[];
  };
  writes: {
    /** Paths that are legitimate declared outputs for this task. */
    reconciled: string[];
    /** Paths that are still not covered by any declared output. */
    stillUnexpected: string[];
  };
  /**
   * `true` when every reported read and write is accounted for by the
   * current workspace configuration.
   */
  ok: boolean;
}

/**
 * Verifies whether file paths reported as sandbox violations would be
 * considered legitimate inputs or outputs in the **current** workspace
 * configuration.
 *
 * ### Path format requirement
 * All paths in {@link SandboxViolationInput.reads} and
 * {@link SandboxViolationInput.writes} **must** be workspace-relative POSIX
 * paths (forward slashes, no leading slash, e.g. `"libs/myproj/src/main.ts"`).
 * The verifier performs no normalisation — callers are responsible for
 * ensuring paths match the format Nx uses internally.
 *
 * ### Inputs reconciliation
 * A read is reconciled when it appears in the fully-expanded `files` array
 * returned by {@link HashPlanInspector.inspectTaskInputs} for the task.
 * Matching is exact set-membership (no glob expansion needed because the
 * inspector already expands all file patterns).
 *
 * ### Outputs reconciliation
 * A write is reconciled when it matches at least one entry from the list
 * returned by {@link getOutputsForTargetAndConfiguration}.  Matching uses:
 * 1. Exact path equality.
 * 2. Prefix match — the write is inside an output directory.
 * 3. Glob match via `minimatch` — handles patterns such as `dist/**`.
 *
 * @param violations - One entry per task whose sandbox was violated.
 * @param options - Workspace context.  The `projectGraph` must already be
 *   fully resolved.  If `nxJson` is omitted it is read from disk using the
 *   provided (or default) `workspaceRoot`.
 */
export async function verifySandboxViolations(
  violations: SandboxViolationInput[],
  options: {
    projectGraph: ProjectGraph;
    nxJson?: NxJsonConfiguration;
    workspaceRoot?: string;
  }
): Promise<SandboxViolationResult[]> {
  if (violations.length === 0) return [];

  const {
    projectGraph,
    nxJson,
    workspaceRoot = defaultWorkspaceRoot,
  } = options;

  // Build the inspector once for the whole batch and initialise it once.
  const inspector = new HashPlanInspector(projectGraph, workspaceRoot, nxJson);
  await inspector.init();

  // Cache inspector results keyed by violation taskId to deduplicate calls
  // when multiple violations share the same task.
  const inputsCache = new Map<string, HashInputs | undefined>();

  function getCachedInputs(taskId: string): HashInputs | undefined {
    if (inputsCache.has(taskId)) {
      return inputsCache.get(taskId);
    }

    const [project, target, configuration] = splitTargetFromNodes(
      taskId,
      projectGraph.nodes,
      { silent: true }
    );

    if (!project || !target) {
      inputsCache.set(taskId, undefined);
      return undefined;
    }

    let result: Record<string, HashInputs> = {};
    try {
      result = inspector.inspectTaskInputs({ project, target, configuration });
    } catch {
      // Project / target not found in graph — treat as no inputs.
    }

    // The result key is usually the same as taskId but may include a
    // defaultConfiguration suffix when none was explicitly given.
    let hashInputs = result[taskId];
    if (!hashInputs) {
      // Fallback: find any key that starts with project:target
      const prefix = `${project}:${target}`;
      for (const [key, inputs] of Object.entries(result)) {
        if (key === prefix || key.startsWith(prefix + ':')) {
          hashInputs = inputs;
          break;
        }
      }
    }

    inputsCache.set(taskId, hashInputs);
    return hashInputs;
  }

  return violations.map((violation) => {
    const { taskId, reads = [], writes = [] } = violation;

    // ── Inputs reconciliation ────────────────────────────────────────────────
    const hashInputs = getCachedInputs(taskId);
    const inputFileSet = new Set<string>(hashInputs?.files ?? []);

    const reconciledReads: string[] = [];
    const unexpectedReads: string[] = [];
    for (const read of reads) {
      if (inputFileSet.has(read)) {
        reconciledReads.push(read);
      } else {
        unexpectedReads.push(read);
      }
    }

    // ── Outputs reconciliation ───────────────────────────────────────────────
    const [project, target, configuration] = splitTargetFromNodes(
      taskId,
      projectGraph.nodes,
      { silent: true }
    );

    let outputPatterns: string[] = [];
    if (project && target) {
      const node = projectGraph.nodes[project];
      if (node) {
        outputPatterns = getOutputsForTargetAndConfiguration(
          { project, target, configuration },
          {},
          node
        );
      }
    }

    const reconciledWrites: string[] = [];
    const unexpectedWrites: string[] = [];
    for (const write of writes) {
      if (matchesAnyOutput(write, outputPatterns)) {
        reconciledWrites.push(write);
      } else {
        unexpectedWrites.push(write);
      }
    }

    const ok = unexpectedReads.length === 0 && unexpectedWrites.length === 0;

    return {
      taskId,
      reads: { reconciled: reconciledReads, stillUnexpected: unexpectedReads },
      writes: {
        reconciled: reconciledWrites,
        stillUnexpected: unexpectedWrites,
      },
      ok,
    };
  });
}

/**
 * Returns `true` when `filePath` is covered by at least one entry in
 * `outputPatterns`.  Handles three cases:
 *
 * 1. **Exact match** — the path equals the pattern literally.
 * 2. **Prefix match** — the path is nested inside a non-glob output directory.
 * 3. **Glob match** — the pattern contains glob characters and `minimatch`
 *    confirms a match (e.g. `dist/**` covers `dist/main.js`).
 */
function matchesAnyOutput(filePath: string, outputPatterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of outputPatterns) {
    const normalizedPattern = pattern.replace(/\\/g, '/');
    if (
      normalized === normalizedPattern ||
      normalized.startsWith(normalizedPattern + '/') ||
      minimatch(normalized, normalizedPattern)
    ) {
      return true;
    }
  }
  return false;
}
