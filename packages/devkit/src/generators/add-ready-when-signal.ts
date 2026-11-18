import {
  getProjects,
  readNxJson,
  updateProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type TargetDefaults,
  type Tree,
} from 'nx/src/devkit-exports';
import { formatFiles } from './format-files';
import { readTargetDefaultsForTarget } from './target-defaults-utils';

/**
 * Migration body that sets `readyWhen: { signal: true }` on the targets running
 * one of `executors`. A target is skipped when it, or the `targetDefaults` that
 * apply to it, already set `readyWhen`, or when its own `continuous`, else the
 * one from `targetDefaults`, is `false`. `onAdded` gets each target it sets it
 * on, with the `targetDefaults` that apply to it. Returning `false` from it
 * leaves that target unchanged.
 */
export async function addReadyWhenSignalToTargets(
  tree: Tree,
  executors: readonly string[],
  onAdded?: (
    target: TargetConfiguration,
    projectName: string,
    defaults: Partial<TargetConfiguration> | null
  ) => boolean | void
): Promise<{ skipAgentic: true } | void> {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  let changed = false;

  for (const [projectName, project] of getProjects(tree)) {
    const projectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: 'lib',
      data: { root: project.root, tags: project.tags },
    };
    let projectChanged = false;

    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (target.command || target.readyWhen !== undefined) {
        continue;
      }
      const defaults = readApplicableTargetDefaults(
        targetName,
        target.executor,
        targetDefaults,
        projectName,
        projectNode
      );
      const executor =
        target.executor ?? (defaults?.command ? undefined : defaults?.executor);
      if (
        !executor ||
        !executors.includes(executor) ||
        (target.continuous ?? defaults?.continuous) === false ||
        defaults?.readyWhen !== undefined
      ) {
        continue;
      }
      target.readyWhen = { signal: true };
      if (onAdded?.(target, projectName, defaults) === false) {
        delete target.readyWhen;
        continue;
      }
      projectChanged = true;
    }

    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, project);
      changed = true;
    }
  }

  if (!changed) {
    return { skipAgentic: true };
  }
  await formatFiles(tree);
}

/**
 * The `targetDefaults` Nx applies to a target, which leaves out the entries
 * that run another executor or a command.
 */
export function readApplicableTargetDefaults(
  targetName: string,
  executor: string | undefined,
  targetDefaults: TargetDefaults | undefined,
  projectName: string,
  projectNode: ProjectGraphProjectNode
): Partial<TargetConfiguration> | null {
  if (!targetDefaults) {
    return null;
  }
  let compatibleDefaults = targetDefaults;
  if (executor) {
    // Nx selects the key first, then drops the entries that run something else.
    // A dropped entry keeps its filter so that its key still wins over the rest.
    compatibleDefaults = {};
    for (const [key, value] of Object.entries(targetDefaults)) {
      const entries: TargetDefaultArrayEntry[] = Array.isArray(value)
        ? value
        : [value];
      compatibleDefaults[key] = entries.map((entry) =>
        entry.command || (entry.executor && entry.executor !== executor)
          ? { filter: entry.filter }
          : entry
      );
    }
  }
  return readTargetDefaultsForTarget(targetName, compatibleDefaults, executor, {
    projectName,
    projectNode,
  });
}
