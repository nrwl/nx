import { logger } from '@nx/devkit';
import {
  interpolate,
  isAiAgent,
  isCI,
  type TaskResult,
} from '@nx/devkit/internal';
import { resolveLintOptions } from './options.js';
import {
  excludedNestedRoots,
  nestedProjectIgnorePatterns,
  normalizeFilename,
  partitionDiagnostics,
} from './partition.js';
import { countBySeverity, renderDiagnostics } from './render/index.js';
import { runOxlint } from './run-oxlint.js';
import type { LintExecutorSchema } from './schema.js';

export interface LintTask {
  taskId: string;
  projectName: string;
  projectRoot: string;
  options: LintExecutorSchema;
}

/**
 * Lints every task with a single Oxlint run and splits the report back per
 * task. Oxlint takes one flag set per process, so the run uses the first
 * task's flags and warns when another task resolves different ones.
 */
export function runLintTasks(
  tasks: LintTask[],
  workspaceRoot: string
): Record<string, TaskResult> {
  const resolved = tasks.map((task) => {
    const paths = (task.options.lintFilePatterns ?? ['{projectRoot}']).map(
      (p) =>
        normalizeFilename(
          interpolate(p, {
            workspaceRoot: '',
            projectRoot: task.projectRoot,
            projectName: task.projectName,
          }),
          workspaceRoot
        )
    );
    return {
      ...task,
      ...resolveLintOptions(task.options),
      paths,
      excludedRoots: excludedNestedRoots(
        paths,
        task.options.nestedProjectRoots ?? []
      ),
    };
  });

  const flags = resolved[0].flags;
  const sharesRunFlags = (r: (typeof resolved)[number]) =>
    r.flags.join('\u0000') === flags.join('\u0000');
  const differing = resolved.find((r) => !sharesRunFlags(r));
  if (differing) {
    logger.warn(
      `[@nx/oxlint] ${differing.projectName} resolves different Oxlint options than ${resolved[0].projectName}. Oxlint runs once for the whole batch, using ${resolved[0].projectName}'s options.`
    );
  }
  const ignores = nestedProjectIgnorePatterns(resolved);
  const paths = [...new Set(resolved.flatMap((r) => r.paths))];

  const startTime = Date.now();
  // A task whose files are all ignored is a clean task, not an error. The
  // forwarded flags go after this executor's own, so a `--` among them cannot
  // turn those into paths.
  const run = runOxlint(
    [
      ...ignores,
      '--no-error-on-unmatched-pattern',
      ...flags,
      ...paths.map((path) => (path.startsWith('-') ? `./${path}` : path)),
    ],
    workspaceRoot
  );
  const endTime = Date.now();

  const results: Record<string, TaskResult> = {};
  if (run.ok === false) {
    for (const { taskId } of resolved) {
      results[taskId] = {
        success: false,
        terminalOutput: run.output + '\n',
        startTime,
        endTime,
      };
    }
    return results;
  }

  for (const diagnostic of run.report.diagnostics) {
    diagnostic.filename = normalizeFilename(
      diagnostic.filename ?? '',
      workspaceRoot
    );
  }
  // The tasks whose flags the run uses also own the diagnostics outside every
  // task's paths: those for a path in the forwarded flags or a config file,
  // and those with no file.
  const byTask = partitionDiagnostics(
    run.report.diagnostics,
    resolved,
    resolved.filter(sharesRunFlags).map((r) => r.taskId)
  );
  const agentMode = !!isCI() || isAiAgent();

  for (const r of resolved) {
    const diagnostics = byTask.get(r.taskId);
    const { errors, warnings } = countBySeverity(diagnostics);
    const success =
      errors === 0 &&
      (!r.denyWarnings || warnings === 0) &&
      (r.maxWarnings === undefined || warnings <= r.maxWarnings);
    results[r.taskId] = {
      success,
      terminalOutput: r.silent
        ? ''
        : renderDiagnostics(r.format, diagnostics, {
            workspaceRoot,
            agentMode,
          }),
      startTime,
      endTime,
    };
  }

  if (resolved.some((r) => !r.silent)) {
    const { number_of_files, threads_count, start_time } = run.report;
    process.stdout.write(
      `Finished in ${Math.round(start_time * 1000)}ms on ${number_of_files} files using ${threads_count} threads.\n`
    );
  }
  return results;
}
