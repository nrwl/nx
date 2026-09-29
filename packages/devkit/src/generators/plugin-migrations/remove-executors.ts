import {
  getProjects,
  logger,
  readNxJson,
  type Tree,
} from 'nx/src/devkit-exports';
import { formatFiles } from '../format-files';

/** The prompt completes conversions the generator cannot safely automate. */
export async function migrateRemovedExecutors(
  tree: Tree,
  executors: string[],
  convert: (
    tree: Tree,
    options: { project: string; skipFormat: boolean }
  ) => Promise<unknown>
): Promise<{ agentContext?: string[]; skipAgentic?: boolean }> {
  const removed = new Set(executors);
  const defaults = readNxJson(tree)?.targetDefaults ?? {};
  const relevantDefaults = Object.fromEntries(
    Object.entries(defaults).filter(
      ([name, value]) =>
        removed.has(name) ||
        (Array.isArray(value) ? value : [value]).some((entry) =>
          removed.has(entry.executor)
        )
    )
  );
  const agentContext: string[] = [];
  let projects: ReturnType<typeof getProjects>;
  try {
    projects = getProjects(tree);
  } catch (error) {
    return {
      agentContext: [
        `Project discovery failed: ${String(error)}. Repair configuration loading, then run convert-to-inferred and complete this migration.`,
      ],
    };
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
    try {
      // Migration runner installs changed dependencies after flushing the Tree.
      // Generator callbacks can install too early here, so leave them to it.
      await convert(tree, { project: name, skipFormat: true });
    } catch (error) {
      // `agentContext` reaches the agentic flow only; warn so a plain
      // `nx migrate --run-migrations` does not report this as a clean run.
      logger.warn(
        `Could not convert ${name}: ${String(error)}. Inspect any partial edits before retrying.`
      );
      agentContext.push(
        `Conversion of ${name} needs repair: ${String(error)}. Inspect any partial edits before retrying.`
      );
    }
  }
  // A converter can return successfully and still leave targets behind: it may
  // not handle an `@nrwl` alias, or the plugin may expose a single option for
  // what the project splits across several targets. Re-scan so those are named
  // rather than inferred from silence.
  const leftovers: string[] = [];
  for (const [name, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (removed.has(target.executor)) {
        leftovers.push(`${name}:${targetName} (${target.executor})`);
      }
    }
  }
  if (leftovers.length) {
    logger.warn(
      `These targets still use removed executors: ${leftovers.join(
        ', '
      )}. Replace each one before running them.`
    );
    agentContext.push(
      `Still using removed executors after conversion: ${leftovers.join(
        ', '
      )}. Replace each one; the converter could not.`
    );
  }

  agentContext.push(
    `Finish conversion of ${executors.join(', ')} to inference plugins. Inspect remaining executor references, including targetDefaults and package.json targets. Preserve all original options and configurations recorded above. A converter returning successfully does not prove every target was converted.`,
    'Before completing this migration, run an uncached project graph and verify migrated targets are inferred. Graph validation is mandatory. Run relevant builds/tests by default; honor the user choosing to skip expensive task validation and report those tasks as unverified.'
  );
  await formatFiles(tree);
  return { agentContext };
}
