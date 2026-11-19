import {
  checkFilesAreOutputs,
  getTaskOutputs,
  type TaskOutputs,
} from '../../../hasher/check-task-files';
import { createTaskId } from '../../../tasks-runner/utils';
import type { ShowTargetOutputsOptions } from '../command-object';
import {
  resolveTarget,
  normalizePath,
  deduplicateFolderEntries,
  pathsUnder,
  pc,
  printJson,
  printList,
  renderCheckResults,
  setCheckExitCode,
  type CheckResult,
} from './utils';

// ── Handler ─────────────────────────────────────────────────────────

export async function showTargetOutputsHandler(
  args: ShowTargetOutputsOptions
): Promise<void> {
  const t = await resolveTarget(args);
  const { projectName, targetName, configuration } = t;

  const taskId = createTaskId(projectName, targetName, configuration);
  const outputs = await getTaskOutputs(taskId, {
    projectGraph: t.graph,
    nxJson: t.nxJson,
  });

  if (args.check !== undefined) {
    const results = await checkOutputs(taskId, args.check, outputs);
    renderCheckResults(results, projectName, targetName, 'output');
    setCheckExitCode(results);
    return;
  }

  renderOutputs(projectName, targetName, outputs, args);
}

// ── Data resolution ─────────────────────────────────────────────────

async function checkOutputs(
  taskId: string,
  check: string[],
  { resolved, expanded }: TaskOutputs
): Promise<CheckResult[]> {
  const checkItems = deduplicateFolderEntries(check);
  const paths = checkItems.map(normalizePath);

  // checkFilesAreOutputs handles exact, directory-prefix and glob matching (and
  // `!` exclusions) through the same native engine the task runner uses.
  const { matched } = await checkFilesAreOutputs(taskId, paths);
  const matchedPaths = new Set(matched);

  return checkItems.map((value, i) => {
    const path = paths[i];
    const isMatch = matchedPaths.has(path);
    return {
      value,
      file: path,
      matched: isMatch,
      contained: isMatch
        ? []
        : [
            ...new Set([
              ...pathsUnder(path, resolved),
              ...pathsUnder(path, expanded),
            ]),
          ],
    };
  });
}

// ── Render ──────────────────────────────────────────────────────────

function renderOutputs(
  project: string,
  target: string,
  { resolved, expanded, unresolved }: TaskOutputs,
  args: ShowTargetOutputsOptions
) {
  if (args.json) {
    printJson({
      project,
      target,
      outputPaths: resolved,
      expandedOutputs: expanded,
      unresolvedOutputs: unresolved,
    });
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Output paths for')} ${c.cyan(project)}:${c.green(target)}`
  );

  printList('Configured outputs', resolved);
  printList('Resolved outputs', expanded);
  printList(`${c.yellow('Unresolved outputs')} (option not set)`, unresolved);

  if (resolved.length === 0 && unresolved.length === 0) {
    console.log(`\n  No outputs configured for this target.`);
  }
}
