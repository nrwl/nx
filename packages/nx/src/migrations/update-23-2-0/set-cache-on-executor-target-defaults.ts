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
import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import {
  getProjects,
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import type { PackageJson } from '../../utils/package-json';
import { joinPathFragments } from '../../utils/path';

// TODO(v24): remove this migration alongside the runtime fallback it exists to
// retire (`isLegacyCachedTarget` in `target-normalization.ts`), along with its
// registration in `packages/nx/migrations.json`.
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
  // per key so the decision below can be made for the key as a whole. The
  // collection is a list rather than a map keyed by target name: two projects
  // routinely declare the same target name through the same executor, and only
  // one of them may be continuous.
  const targetsByExecutorKey = new Map<
    string,
    Array<[string, TargetConfiguration]>
  >();
  const collect = (targetName: string, target: TargetConfiguration) => {
    // `hasOwnProperty` rather than a lookup: an executor named `__proto__` or
    // `constructor` resolves through the prototype chain to a truthy object, so
    // a plain lookup would collect the target and stamp `Object.prototype`.
    if (
      !target?.executor ||
      !Object.prototype.hasOwnProperty.call(targetDefaults, target.executor)
    ) {
      return;
    }
    const targets = targetsByExecutorKey.get(target.executor) ?? [];
    targets.push([targetName, target]);
    targetsByExecutorKey.set(target.executor, targets);
  };
  for (const [projectName, project] of projects) {
    projectsMap[projectName] = project;
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      collect(targetName, target);
    }
    for (const [targetName, target] of Object.entries(
      packageJsonTargets(tree, project.root)
    )) {
      collect(targetName, target);
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
  await formatChangedFiles(tree);
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
  targets: Array<[string, TargetConfiguration]>,
  workspaceRoot: string,
  projectsMap: Record<string, ProjectConfiguration>
): boolean {
  // Targets written with `command` are rewritten to `nx:run-commands` and
  // `package.json` scripts to `nx:run-script` before key selection, so neither
  // names the key it resolves through. Plugins also infer continuous targets
  // (`watch-deps`, dev servers) into projects whose config never mentions them.
  // The target list here can never be trusted to be complete for these keys.
  if (key === 'nx:run-commands' || key === 'nx:run-script') {
    return false;
  }

  // Already decided; never override the user's value. A filtered entry counts
  // as decided because its value can't be evaluated without project context.
  if (declaresAnyCache(targetDefaults[key])) {
    return false;
  }

  // `continuous` is a valid field on a target default, and this key applies it
  // to every target that resolves through it. Adding `cache` would make each of
  // them both cacheable and continuous, which fails graph construction — so no
  // target list can make this key safe.
  if (declaresAnyContinuous(targetDefaults[key])) {
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
  // all. For what an executor that cannot be resolved here costs, see
  // {@link executorDeclaresContinuous}.
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

/**
 * Whether any entry declares `continuous: true`. Filtered entries count: which
 * projects the filter matches is unknowable here, and the only case that
 * matters is the one where it matches.
 */
function declaresAnyContinuous(value: TargetDefaultValue | undefined): boolean {
  if (!value) {
    return false;
  }
  return configEntries(value).some((entry) => entry.continuous === true);
}

/**
 * The config blocks of a `targetDefaults` value. Entries that are not config
 * objects are dropped rather than inspected: `nx.json` is hand-edited, and a
 * `null` or scalar entry would otherwise throw while reading `.cache` off it.
 */
function configEntries(value: TargetDefaultValue): TargetDefaultArrayEntry[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.filter(
    (entry): entry is TargetDefaultArrayEntry =>
      !!entry && typeof entry === 'object'
  );
}

/**
 * The targets a project's `package.json` contributes to the graph.
 *
 * {@link getProjects} builds a root's configuration from its `project.json`
 * alone whenever one exists, but the package.json plugin still creates the
 * sibling `package.json`'s targets — it accepts any `package.json` that is
 * either in the package manager workspaces or next to a `project.json`
 * (`plugins/package-json/create-nodes.ts`). Those targets resolve through the
 * same executor keys, so they belong in this decision.
 *
 * Targets derived from `scripts` are still not covered; they resolve through
 * `nx:run-script`, which is never stamped for exactly that reason.
 */
function packageJsonTargets(
  tree: Tree,
  projectRoot: string
): Record<string, TargetConfiguration> {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  if (!tree.exists(packageJsonPath)) {
    return {};
  }
  // A parse failure is left to throw: `readJson` names the offending file,
  // which is the one thing a user can act on. Shapes that parse but aren't the
  // one this reads contribute no targets rather than crashing the run.
  const targets = readJson<PackageJson>(tree, packageJsonPath)?.nx?.targets;
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
    return {};
  }
  return targets;
}

/**
 * The unfiltered config block of a `targetDefaults` value, or undefined when the
 * array form carries only filtered entries and when the value is not a config
 * object at all. Never creates one — see {@link canEnableCache}.
 */
function catchAllConfig(
  value: TargetDefaultValue
): TargetDefaultArrayEntry | undefined {
  // The filter check applies to both spellings: the object and single-element
  // array forms of the same config have to reach the same verdict.
  return configEntries(value).find((entry) => entry.filter === undefined);
}

/**
 * Whether the executor's schema marks its targets continuous, resolved through
 * the same `getExecutorInformation` call `normalizeTarget` makes at graph
 * construction, so the two cannot drift on what continuous means.
 *
 * An executor that cannot be resolved is read as not continuous. That is the
 * same answer `normalizeTarget` gives, but not the same trade: its lookup is
 * repeated on every graph construction, so a failure there corrects itself,
 * whereas this one decides a permanent edit to `nx.json`. An executor that is
 * unresolvable while the migration runs and resolvable afterwards therefore
 * keeps its stamped `cache` while the runtime starts marking its targets
 * continuous — which `normalizeTargets` rejects with a `WorkspaceValidityError`,
 * failing graph construction until `nx.json` is edited by hand.
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
