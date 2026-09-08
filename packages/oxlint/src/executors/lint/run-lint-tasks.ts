import { logger, type ProjectGraph } from '@nx/devkit';
import { interpolate, isAiAgent, isCI } from '@nx/devkit/internal';
import { resolveLintOptions } from './options.js';
import {
  nestedProjectIgnorePatterns,
  normalizeFilename,
  partitionDiagnostics,
} from './partition.js';
import { countBySeverity, renderDiagnostics } from './render/index.js';
import { runOxlint } from './run-oxlint.js';
import type { LintExecutorSchema } from './schema.js';

export const LINT_EXECUTOR = '@nx/oxlint:lint';

export interface LintTask {
  taskId: string;
  projectName: string;
  projectRoot: string;
  options: LintExecutorSchema;
}

export interface LintTaskResult {
  success: boolean;
  terminalOutput: string;
  startTime: number;
  endTime: number;
}

/**
 * Lints every task with a single Oxlint run and splits the report back per
 * task. Flags are shared by the run, so a flag two tasks set to different
 * values is reported once and the last one wins.
 */
export function runLintTasks(
  tasks: LintTask[],
  workspaceRoot: string,
  projectGraph: ProjectGraph
): Record<string, LintTaskResult> {
  const resolved = tasks.map((task) => ({
    task,
    options: resolveLintOptions(task.options),
    paths: (task.options.lintFilePatterns ?? ['{projectRoot}']).map((p) =>
      normalizeFilename(
        interpolate(p, {
          workspaceRoot: '',
          projectRoot: task.projectRoot,
          projectName: task.projectName,
        }),
        workspaceRoot
      )
    ),
  }));

  // One Oxlint process gets one flag set: the first task's. Format, --silent
  // and the warning thresholds still apply per task.
  const flags = resolved[0].options.flags;
  const differing = resolved.find(
    (r) => r.options.flags.join('\u0000') !== flags.join('\u0000')
  );
  if (differing) {
    logger.warn(
      `[@nx/oxlint] ${differing.task.projectName} resolves different Oxlint options than ${resolved[0].task.projectName}. Oxlint runs once for the whole batch, using ${resolved[0].task.projectName}'s options.`
    );
  }
  const ignores = nestedProjectIgnorePatterns(
    resolved.map((r) => ({ projectRoot: r.task.projectRoot, paths: r.paths })),
    oxlintProjectRoots(projectGraph)
  );
  const paths = [...new Set(resolved.flatMap((r) => r.paths))];

  const startTime = Date.now();
  // A task whose files are all ignored is a clean task, not an error.
  const run = runOxlint(
    [...flags, ...ignores, '--no-error-on-unmatched-pattern', ...paths],
    workspaceRoot
  );
  const endTime = Date.now();

  const results: Record<string, LintTaskResult> = {};
  if (run.ok === false) {
    for (const { task } of resolved) {
      results[task.taskId] = {
        success: false,
        terminalOutput: run.output + '\n',
        startTime,
        endTime,
      };
    }
    return results;
  }

  for (const diagnostic of run.report.diagnostics) {
    diagnostic.filename = normalizeFilename(diagnostic.filename, workspaceRoot);
  }
  const byTask = partitionDiagnostics(
    run.report.diagnostics,
    resolved.map((r) => ({ taskId: r.task.taskId, paths: r.paths }))
  );
  const agentMode = !!isCI() || isAiAgent();

  for (const { task, options } of resolved) {
    const diagnostics = byTask.get(task.taskId);
    const { errors, warnings } = countBySeverity(diagnostics);
    const success =
      errors === 0 &&
      (!options.denyWarnings || warnings === 0) &&
      (options.maxWarnings === undefined || warnings <= options.maxWarnings);
    results[task.taskId] = {
      success,
      terminalOutput: options.silent
        ? ''
        : renderDiagnostics(options.format, diagnostics, {
            workspaceRoot,
            agentMode,
          }),
      startTime,
      endTime,
    };
  }

  const { number_of_files, threads_count, start_time } = run.report;
  process.stdout.write(
    `Finished in ${Math.round(start_time * 1000)}ms on ${number_of_files} files using ${threads_count} threads.\n`
  );
  return results;
}

function oxlintProjectRoots(projectGraph: ProjectGraph): string[] {
  const roots: string[] = [];
  for (const node of Object.values(projectGraph.nodes)) {
    if (
      Object.values(node.data.targets ?? {}).some(
        (t) => t.executor === LINT_EXECUTOR
      )
    ) {
      roots.push(node.data.root);
    }
  }
  return roots;
}
