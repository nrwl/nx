import type { TargetConfiguration } from '../../../config/workspace-json-project-json';
import type { HashInputs } from '../../../native';
import {
  checkFilesAreInputs,
  getTaskRawInputs,
} from '../../../hasher/check-task-files';
import { createTaskId } from '../../../tasks-runner/utils';
import type { ShowTargetInputsOptions } from '../command-object';
import {
  resolveTarget,
  normalizePath,
  deduplicateFolderEntries,
  hasCustomHasher,
  pathsUnder,
  pc,
  printJson,
  printList,
  renderCheckResults,
  setCheckExitCode,
  type CheckResult,
} from './utils';

// ── Handler ─────────────────────────────────────────────────────────

export async function showTargetInputsHandler(
  args: ShowTargetInputsOptions
): Promise<void> {
  const t = await resolveTarget(args);
  const { projectName, targetName, configuration } = t;

  if (hasCustomHasher(projectName, targetName, t.graph)) {
    renderCustomHasherWarning(projectName, targetName, args);
    process.exitCode = 1;
    return;
  }

  const taskId = createTaskId(projectName, targetName, configuration);

  const hashInputs = await getTaskRawInputs(taskId);
  if (!hashInputs) {
    throw new Error(`Could not find hash plan for task "${taskId}".`);
  }

  if (args.check !== undefined) {
    const results = await checkInputs(taskId, args.check, hashInputs);
    renderCheckResults(results, projectName, targetName, 'input');
    setCheckExitCode(results);
    return;
  }

  renderInputs(
    { project: projectName, target: targetName, ...hashInputs },
    t.node.data.targets[targetName].inputs,
    args
  );
}

// ── Data resolution ─────────────────────────────────────────────────

async function checkInputs(
  taskId: string,
  check: string[],
  hashInputs: HashInputs
): Promise<CheckResult[]> {
  // checkFilesAreInputs matches environment/runtime/external names against the
  // raw argument and paths against the workspace-relative form, so both are
  // passed through — it has no cwd of its own.
  const candidates = deduplicateFolderEntries(check).map((value) => ({
    value,
    path: normalizePath(value),
  }));

  const { categories } = await checkFilesAreInputs(taskId, candidates);

  return candidates.map(({ value, path }) => {
    const category = categories.get(value);
    return {
      value,
      file: path,
      matched: !!category,
      category,
      contained: category ? [] : pathsUnder(path, hashInputs.files),
    };
  });
}

// ── Render ──────────────────────────────────────────────────────────

function renderInputs(
  data: HashInputs & { project: string; target: string },
  configuredInputs: TargetConfiguration['inputs'] | undefined,
  args: ShowTargetInputsOptions
) {
  if (args.json) {
    printJson(data as unknown as Record<string, unknown>);
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Inputs for')} ${c.cyan(data.project)}:${c.green(data.target)}`
  );

  if (configuredInputs?.length) {
    printList(
      'Configured inputs',
      configuredInputs.map((i) =>
        typeof i === 'string' ? i : JSON.stringify(i)
      )
    );
  }

  printList('External dependencies', [...data.external].sort());
  printList('Runtime inputs', [...data.runtime].sort());
  printList('Environment variables', [...data.environment].sort());
  printList(
    `Files (${data.files.length})`,
    [...data.files, ...data.depOutputs].sort()
  );
}

function renderCustomHasherWarning(
  projectName: string,
  targetName: string,
  args: ShowTargetInputsOptions
) {
  const c = pc();

  if (args.json) {
    printJson({
      project: projectName,
      target: targetName,
      warning:
        'This target uses a custom hasher. Configured inputs do not affect the cache hash.',
    });
    return;
  }

  const label = `${c.cyan(projectName)}:${c.green(targetName)}`;
  console.log(
    `\n${c.yellow('⚠')} ${label} uses a ${c.yellow('custom hasher')}.`
  );
  console.log(
    `  Configured inputs do not affect the cache hash for this target.`
  );
  console.log(
    `  The executor's hasher determines what is included in the hash.`
  );
}
