import type {
  TargetDefaultArrayEntry,
  TargetDefaults,
  TargetDefaultValue,
} from '../../config/nx-json';
import type {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import {
  getExecutorInformation,
  parseExecutor,
} from '../../command-line/run/executor-utils';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import {
  getProjects,
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';

/**
 * Target defaults resolve to a single key rather than merging, so an executor
 * key hides the target name key entirely. Before Nx 23 a hidden `cache: true`
 * still took effect, because cacheability was also derived from target *names*
 * via `cacheableOperations`; Nx 23 removed that derivation and those targets
 * silently stopped being cacheable.
 *
 * Write the intent into the executor key so it no longer depends on the
 * deprecated fallback that restores the old behavior at run time.
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  const targetDefaults = nxJson?.targetDefaults;
  if (!targetDefaults) {
    return;
  }

  const projects = getProjects(tree);
  const projectsMap: Record<string, ProjectConfiguration> = {};
  // `cache` on an executor key reaches every target that resolves through it,
  // not just the one whose target name key enables caching. Collect them all
  // per key so the decision below can be made for the key as a whole.
  const targetsByExecutorKey = new Map<
    string,
    Map<string, TargetConfiguration>
  >();
  for (const [projectName, project] of projects) {
    projectsMap[projectName] = project;
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (!target.executor || !targetDefaults[target.executor]) {
        continue;
      }
      const targets = targetsByExecutorKey.get(target.executor) ?? new Map();
      targets.set(targetName, target);
      targetsByExecutorKey.set(target.executor, targets);
    }
  }

  let changed = false;
  for (const [key, targets] of targetsByExecutorKey) {
    if (!canEnableCache(targetDefaults, key, targets, tree.root, projectsMap)) {
      continue;
    }
    catchAllConfig(targetDefaults[key]).cache = true;
    changed = true;
  }

  if (!changed) {
    return;
  }

  updateNxJson(tree, nxJson);
  await formatChangedFilesWithPrettierIfAvailable(tree);
}

/**
 * Whether `cache: true` can be written onto `key` without changing behavior for
 * any target that resolves through it.
 *
 * The executor key outranks every target name key, so stamping it caches all of
 * `targets` — including any that is continuous, which makes `nx.json` fail graph
 * construction outright. The key is only safe when every target through it
 * independently wants caching and none of them can be continuous. Anything else
 * is left to the runtime fallback, which decides per target after normalization
 * and can therefore see continuity this migration cannot.
 */
function canEnableCache(
  targetDefaults: TargetDefaults,
  key: string,
  targets: Map<string, TargetConfiguration>,
  workspaceRoot: string,
  projectsMap: Record<string, ProjectConfiguration>
): boolean {
  // `command` targets are rewritten to this executor before key selection, and
  // plugins infer continuous ones (`watch-deps`, dev servers) into projects
  // whose config never mentions them — so the target list here can never be
  // trusted to be complete for this key.
  if (key === 'nx:run-commands') {
    return false;
  }

  // Already decided; never override the user's value. A filtered entry counts
  // as decided because its value can't be evaluated without project context.
  if (declaresAnyCache(targetDefaults[key])) {
    return false;
  }

  // Only an unfiltered entry can be amended. Appending a catch-all to an
  // all-filtered key would make it match targets that previously fell through
  // to the target name key, silently dropping that key's `dependsOn`/`inputs`.
  if (!catchAllConfig(targetDefaults[key])) {
    return false;
  }

  // Continuity declared by the executor's schema is resolved at graph
  // construction for every target through this key, so one lookup covers them
  // all. An executor that can't be resolved here can't be resolved there
  // either, so the runtime won't mark those targets continuous and no
  // conflicting `nx.json` can result.
  if (executorDeclaresContinuous(key, workspaceRoot, projectsMap)) {
    return false;
  }

  for (const [targetName, target] of targets) {
    if (!declaresCacheTrue(targetDefaults[targetName])) {
      return false;
    }
    if (target.continuous || isLongRunningTargetName(targetName)) {
      return false;
    }
  }
  return true;
}

/**
 * Whether the target name key declares `cache: true` on an entry that always
 * applies. Mirrors `declaresCacheTrue` in `target-normalization.ts`: a filtered
 * entry declaring `cache` makes the value unknowable without project context,
 * so nothing is claimed. Among unfiltered entries the last wins.
 */
function declaresCacheTrue(value: TargetDefaultValue | undefined): boolean {
  if (!value) {
    return false;
  }
  let declared: boolean | undefined;
  for (const entry of configEntries(value)) {
    if (entry.cache === undefined) continue;
    if (entry.filter) return false;
    declared = entry.cache;
  }
  return declared === true;
}

/**
 * Whether any entry declares `cache`, filtered or not — i.e. whether the value
 * is already decided and must be left alone. Deliberately broader than
 * {@link declaresCacheTrue}: a filtered `cache` blocks here rather than being
 * read past, so the two never disagree about a filtered entry.
 */
function declaresAnyCache(value: TargetDefaultValue | undefined): boolean {
  if (!value) {
    return false;
  }
  return configEntries(value).some((entry) => entry.cache !== undefined);
}

function configEntries(value: TargetDefaultValue): TargetDefaultArrayEntry[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * The unfiltered config block of a `targetDefaults` value, or undefined when the
 * array form carries only filtered entries. Never creates one — see
 * {@link canEnableCache}.
 */
function catchAllConfig(
  value: TargetDefaultValue
): TargetDefaultArrayEntry | undefined {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.find((entry) => entry.filter === undefined);
}

/**
 * Whether the executor's schema marks its targets continuous, the way
 * `normalizeTarget` reads it at graph construction. Mirrors that function's
 * fail-open behavior: an unresolvable executor yields no continuity there
 * either.
 */
function executorDeclaresContinuous(
  executor: string,
  workspaceRoot: string,
  projectsMap: Record<string, ProjectConfiguration>
): boolean {
  try {
    const [nodeModule, name] = parseExecutor(executor);
    const { schema } = getExecutorInformation(
      nodeModule,
      name,
      workspaceRoot,
      projectsMap
    );
    return !!schema.continuous;
  } catch {
    return false;
  }
}

/**
 * Target names the pre-23 `longRunningTask` guard excluded from caching.
 * Mirrors `isLongRunningTarget` in `target-normalization.ts`.
 */
function isLongRunningTargetName(targetName: string): boolean {
  return (
    targetName.endsWith(':watch') ||
    targetName.endsWith('-watch') ||
    targetName === 'serve' ||
    targetName === 'dev' ||
    targetName === 'start'
  );
}
