import {
  getProjects,
  logger,
  readNxJson,
  type Tree,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { formatFiles } from '../format-files';
import {
  NoTargetsToMigrateError,
  removeDeadExecutorTargetDefault,
} from './executor-to-plugin-migrator';

/** The prompt completes conversions the generator cannot safely automate. */
export async function migrateRemovedExecutors(
  tree: Tree,
  executors: string[],
  convert: (tree: Tree, options: { skipFormat: boolean }) => Promise<unknown>
): Promise<{
  nextSteps?: string[];
  agentContext?: string[];
  skipAgentic?: boolean;
}> {
  const removed = new Set(executors);
  const defaults = readNxJson(tree)?.targetDefaults ?? {};
  const relevantDefaults = filterDefaults(defaults, removed);
  const agentContext: string[] = [];
  const nextSteps: string[] = [];
  let projects: ReturnType<typeof getProjects>;
  try {
    projects = getProjects(tree);
  } catch (error) {
    const message = `Project discovery failed: ${String(error)}. Repair configuration loading, then run convert-to-inferred and complete this migration.`;
    return { nextSteps: [message], agentContext: [message] };
  }
  const affected = [...projects].filter(([, project]) =>
    Object.values(project.targets ?? {}).some((target) =>
      removed.has(target.executor)
    )
  );
  if (!affected.length && !Object.keys(relevantDefaults).length) {
    return { skipAgentic: true };
  }

  // Capture options before converters remove them, including executor defaults.
  agentContext.push(
    `Pre-migration targetDefaults: ${JSON.stringify(defaults)}`
  );
  for (const [name, project] of affected) {
    agentContext.push(
      `Pre-migration project ${name}: ${JSON.stringify(project)}`
    );
  }
  if (affected.length) {
    try {
      // Migration runner installs changed dependencies after flushing the Tree.
      // Generator callbacks can install too early here, so leave them to it.
      await convert(tree, { skipFormat: true });
    } catch (error) {
      // Thrown when the converter skipped every target; the re-scan below
      // names them.
      if (!(error instanceof NoTargetsToMigrateError)) {
        const message = `Could not convert targets using removed executors: ${String(error)}. Inspect any partial edits before retrying.`;
        logger.warn(message);
        nextSteps.push(message);
        agentContext.push(
          `Conversion needs repair: ${String(error)}. Inspect any partial edits before retrying.`
        );
      }
    }
  }
  // Converters skip targets they cannot convert safely, with a warning, and
  // some ignore `@nrwl` aliases. Re-scan so those are named rather than
  // inferred from silence.
  const leftovers: string[] = [];
  const usedExecutors = new Set<string>();
  for (const [name, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (removed.has(target.executor)) {
        leftovers.push(`${name}:${targetName} (${target.executor})`);
        usedExecutors.add(target.executor);
      }
    }
  }
  if (leftovers.length) {
    const message = `These targets still use removed executors: ${leftovers.join(
      ', '
    )}. Replace each one before running them.`;
    logger.warn(message);
    nextSteps.push(message);
    agentContext.push(
      `Still using removed executors after conversion: ${leftovers.join(
        ', '
      )}. Replace each one; the converter could not.`
    );
  }

  removeDeadExecutorDefaults(tree, removed, usedExecutors);

  // Targets that inherit the executor from targetDefaults declare none
  // themselves, so the scans above cannot see them.
  const defaultNames = Object.keys(
    filterDefaults(readNxJson(tree)?.targetDefaults ?? {}, removed)
  );
  if (defaultNames.length) {
    const message = `These nx.json targetDefaults still use removed executors: ${defaultNames.join(
      ', '
    )}. Move the options that still apply to the inferred targets, then remove them.`;
    logger.warn(message);
    nextSteps.push(message);
    agentContext.push(message);
  }

  agentContext.push(
    `Finish conversion of ${executors.join(', ')} to inference plugins. Inspect remaining executor references, including targetDefaults and package.json targets. Preserve all original options and configurations recorded above. A converter returning successfully does not prove every target was converted.`,
    'Before completing this migration, run an uncached project graph and verify migrated targets are inferred. Graph validation is mandatory. Run relevant builds/tests by default; honor the user choosing to skip expensive task validation and report those tasks as unverified.'
  );
  await formatFiles(tree);
  return nextSteps.length ? { nextSteps, agentContext } : { agentContext };
}

// The converters merge an unfiltered executor-keyed default into every target
// they convert, so the entry is dead once no target resolves to the executor.
function removeDeadExecutorDefaults(
  tree: Tree,
  removed: Set<string>,
  usedExecutors: Set<string>
) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.targetDefaults) {
    return;
  }
  const liveExecutors = new Set(usedExecutors);
  // A target-name default that sets the executor hands it to the targets
  // inheriting from it, which the executor-keyed default still configures.
  for (const value of Object.values(nxJson.targetDefaults)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry?.executor) {
        liveExecutors.add(entry.executor);
      }
    }
  }
  const before = JSON.stringify(nxJson.targetDefaults);
  for (const executor of removed) {
    if (!liveExecutors.has(executor)) {
      removeDeadExecutorTargetDefault(nxJson, executor);
    }
  }
  if (JSON.stringify(nxJson.targetDefaults) !== before) {
    updateNxJson(tree, nxJson);
  }
}

function filterDefaults(
  defaults: NonNullable<ReturnType<typeof readNxJson>['targetDefaults']>,
  removed: Set<string>
) {
  return Object.fromEntries(
    Object.entries(defaults).filter(
      ([name, value]) =>
        removed.has(name) ||
        (Array.isArray(value) ? value : [value]).some(
          (entry) =>
            removed.has(entry.executor) || removed.has(entry.filter?.executor)
        )
    )
  );
}
