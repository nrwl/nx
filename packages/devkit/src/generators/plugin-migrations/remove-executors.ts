import {
  createProjectGraphAsync,
  getProjects,
  logger,
  readCachedProjectGraph,
  readNxJson,
  type Tree,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { readSourceMapsCache } from 'nx/src/devkit-internals';
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
  const pluginTargets = await findPluginTargets(removed, projects);
  if (pluginTargets === null) {
    const message =
      'The project graph could not be created, so targets created by plugins were not checked for removed executors. Inspect the project graph for targets that still use them, and change the plugin that creates each one.';
    nextSteps.push(message);
    agentContext.push(message);
  }
  if (
    !affected.length &&
    !Object.keys(relevantDefaults).length &&
    !pluginTargets?.length
  ) {
    return nextSteps.length
      ? { skipAgentic: true, nextSteps }
      : { skipAgentic: true };
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
  const usedExecutors = new Set(
    pluginTargets?.map((target) => target.executor)
  );
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

  if (pluginTargets?.length) {
    const names = pluginTargets
      .map(
        ({ project, target, executor, plugin }) =>
          `${project}:${target} (${executor}${plugin ? `, from ${plugin}` : ''})`
      )
      .join(', ');
    const message = `According to the project graph, these targets are created by plugins and use removed executors: ${names}. This migration cannot convert them; change the plugin that creates each one before running them.`;
    logger.warn(message);
    nextSteps.push(message);
    agentContext.push(message);
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

interface PluginTarget {
  project: string;
  target: string;
  executor: string;
  plugin?: string;
}

const configurationPlugins = new Set([
  'nx/core/project-json',
  'nx/core/package-json',
  'nx/target-defaults',
]);

// Every plugin's remove-executors migration runs in one `nx migrate` process,
// and a failed graph build leaves no usable cache, so build it at most once.
const graphUnavailable = Symbol.for(
  '@nx/devkit/remove-executors/graph-unavailable'
);

/**
 * Graph targets that use a removed executor which project configuration does
 * not declare. Returns `null` when the graph cannot be created.
 */
async function findPluginTargets(
  removed: Set<string>,
  projects: ReturnType<typeof getProjects>
): Promise<PluginTarget[] | null> {
  if (globalThis[graphUnavailable]) {
    return null;
  }
  let graph: ReturnType<typeof readCachedProjectGraph>;
  try {
    graph = readCachedProjectGraph();
  } catch {
    try {
      graph = await createProjectGraphAsync();
    } catch {
      globalThis[graphUnavailable] = true;
      logger.warn(
        'The project graph could not be created, so targets created by plugins were not checked for removed executors.'
      );
      return null;
    }
  }
  // Older nx versions do not export the source map reader.
  const sourceMaps =
    typeof readSourceMapsCache === 'function' ? readSourceMapsCache() : null;
  const found: PluginTarget[] = [];
  for (const [name, node] of Object.entries(graph.nodes)) {
    const declared = projects.get(name)?.targets ?? {};
    const sourceMap = sourceMaps?.[node.data.root] ?? {};
    for (const [targetName, target] of Object.entries(
      node.data.targets ?? {}
    )) {
      if (
        !removed.has(target.executor) ||
        declared[targetName]?.executor ||
        declared[targetName]?.command
      ) {
        continue;
      }
      const plugin = (sourceMap[`targets.${targetName}.executor`] ??
        sourceMap[`targets.${targetName}`])?.[1];
      if (configurationPlugins.has(plugin)) {
        continue;
      }
      found.push({
        project: name,
        target: targetName,
        executor: target.executor,
        plugin,
      });
    }
  }
  return found;
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
