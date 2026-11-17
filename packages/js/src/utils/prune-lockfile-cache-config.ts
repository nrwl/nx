import {
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type Tree,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';
import {
  DEFAULT_INPUTS,
  compatibleDefaultsEntries,
  hasRuntimeInput,
  lastMatchingInputsSupplier,
  namedFilesets,
  resolveDefaultsExecutor,
  selectDefaultsKey,
  type KeyedTargetRef,
  type MatchedTargetRef,
} from './target-defaults-matching';

const PRUNE_LOCKFILE_EXECUTOR = '@nx/js:prune-lockfile';

interface PruneLockfileCacheConfig {
  /** The lockfile whose `outputs` entry identifies a package manager's prune targets. */
  lockFile: string;
  /** What the executor emits next to the pruned lockfile, beside its entry. */
  artifacts: readonly string[];
  /** The workspace root sources those artifacts are built from. */
  rootInputs: readonly (string | { runtime: string })[];
}

/**
 * Adds `artifacts` to the `outputs` of `@nx/js:prune-lockfile` targets that
 * declare `lockFile`, and `rootInputs` to their `inputs`, on whichever layer
 * (the target or a `targetDefaults` entry) the runtime reads each from.
 */
export function addPruneLockfileCacheConfig(
  tree: Tree,
  config: PruneLockfileCacheConfig
): void {
  const nxJson = readNxJson(tree);
  const targetDefaults = nxJson?.targetDefaults;
  const pruneTargets: MatchedTargetRef[] = [];
  const projects = new Map<string, ProjectConfiguration>();
  const changedProjects = new Set<string>();
  for (const [projectName, project] of getProjects(tree)) {
    projects.set(projectName, project);
    const projectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: 'lib',
      data: { root: project.root, tags: project.tags },
    };
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      // The executor may come from a matching targetDefaults entry rather
      // than the target itself. A `command` target resolves to nx:run-commands
      // before defaults apply, so a default can never make it a prune target.
      const executor =
        target.executor ??
        (target.command
          ? 'nx:run-commands'
          : resolveDefaultsExecutor(
              targetName,
              projectName,
              projectNode,
              targetDefaults,
              PRUNE_LOCKFILE_EXECUTOR
            ));
      if (executor !== PRUNE_LOCKFILE_EXECUTOR) {
        continue;
      }
      pruneTargets.push({
        targetName,
        projectName,
        projectNode,
        matcherExecutor: target.executor,
        target,
      });
      if (appendPruneOutputs(target, config)) {
        changedProjects.add(projectName);
      }
    }
  }

  let defaultsChanged = false;
  // runtime applies only the first key that resolves for a target (executor,
  // exact name, then longest glob), so anchor each prune target to its
  // selected key
  const keyedPruneTargets = pruneTargets.map<KeyedTargetRef>((ref) => ({
    ref,
    selectedKey: targetDefaults
      ? selectDefaultsKey(ref, targetDefaults, PRUNE_LOCKFILE_EXECUTOR)
      : null,
  }));
  if (targetDefaults) {
    for (const [key, value] of Object.entries(targetDefaults)) {
      // a value may be the plain object form or the filtered array form
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (!appliesToPruneLockfileTargets(key, entry, keyedPruneTargets)) {
          continue;
        }
        defaultsChanged = appendPruneOutputs(entry, config) || defaultsChanged;
      }
    }
  }

  // `inputs` is decided separately from `outputs`, because the two can be
  // authored on different layers and a target's own `inputs` replaces the
  // defaults' array rather than merging with it. The sources are only ever
  // appended to an array that already exists, or written with nx's default as
  // the base when no layer declares one. The migration never authors a `'...'`
  // of its own: whether the entry it would expand against survives depends on
  // the document-order identity resets in nx's own merge, and a spread that
  // ends up with nothing to expand narrows the target to the root sources.
  for (const { ref, selectedKey } of keyedPruneTargets) {
    const entries = compatibleDefaultsEntries(ref, selectedKey, targetDefaults);
    const defaults = entries.length
      ? readTargetDefaultsForTarget(
          ref.targetName,
          { [selectedKey]: entries },
          ref.matcherExecutor,
          { projectName: ref.projectName, projectNode: ref.projectNode }
        )
      : null;
    // The effective outputs, not the target's own array: a target inheriting
    // its lockfile entry, or spreading the defaults' outputs into its own, is
    // still this package manager's prune target.
    const effective = mergeTargetConfigurations(ref.target, defaults ?? {});
    if (!declaresLockfile(effective.outputs, config.lockFile)) {
      continue;
    }
    if (ref.target.inputs !== undefined) {
      // A target's own array wins outright, so nothing else can carry them.
      if (
        addRootSettingsInputs(ref.target, config.rootInputs, effective.inputs)
      ) {
        changedProjects.add(ref.projectName);
      }
      continue;
    }
    // Otherwise they belong to the entry supplying the array the target
    // inherits, which is the last matching one declaring `inputs`.
    const supplier = lastMatchingInputsSupplier(ref, selectedKey, entries);
    if (supplier) {
      defaultsChanged =
        addRootSettingsInputs(supplier, config.rootInputs, effective.inputs) ||
        defaultsChanged;
    } else if (
      addRootSettingsInputs(ref.target, config.rootInputs, effective.inputs)
    ) {
      changedProjects.add(ref.projectName);
    }
  }
  // A workspace configuring its prune targets purely through `targetDefaults`
  // has no concrete target to carry the decision above.
  if (targetDefaults && pruneTargets.length === 0) {
    for (const [key, value] of Object.entries(targetDefaults)) {
      const entries = Array.isArray(value) ? value : [value];
      // The key qualifies only when it locates the executor without a
      // concrete target to resolve against: the key itself, an entry pinning
      // it, or an entry filtering on it. Every identity-compatible sibling
      // still merges for such a target, an identity-neutral one included.
      const compatible = entries.filter(entryIdentityCompatible);
      const locatesExecutor =
        key === PRUNE_LOCKFILE_EXECUTOR ||
        compatible.some(
          (entry) =>
            entry.executor === PRUNE_LOCKFILE_EXECUTOR ||
            entry.filter?.executor === PRUNE_LOCKFILE_EXECUTOR
        );
      if (
        !locatesExecutor ||
        !compatible.some((entry) =>
          declaresLockfile(entry.outputs, config.lockFile)
        )
      ) {
        continue;
      }
      // Every compatible entry declaring `inputs` can be the array a future
      // target inherits (a later filtered one replaces it for its projects),
      // so each carries the sources itself; a sibling's array covers nothing
      // unless a `'...'` spread pulls it in, in which case only the strictly
      // filter-less earlier entries are the base it expands against: a
      // filtered one supplies nothing to the targets its filter excludes,
      // an executor filter failing for a target whose executor a sibling
      // supplies (earlier entries are updated first, so the base is checked
      // with the sources already added).
      const suppliers = compatible.filter(
        (entry) => entry.inputs !== undefined
      );
      for (const [index, entry] of compatible.entries()) {
        if (entry.inputs === undefined) {
          continue;
        }
        const reference = entry.inputs.includes('...')
          ? [
              ...entry.inputs,
              ...compatible
                .slice(0, index)
                .filter((earlier) => !earlier.filter)
                .flatMap((earlier) => earlier.inputs ?? []),
            ]
          : entry.inputs;
        defaultsChanged =
          addRootSettingsInputs(entry, config.rootInputs, reference) ||
          defaultsChanged;
      }
      // Targets no filtered supplier matches fall back to nx's own default
      // when no filter-less entry declares an array, so the spelled-out
      // default is prepended as its own entry: prepending keeps it from
      // replacing a later supplier's array. A prepended carrier must match
      // only targets an existing entry already matched, or the key starts
      // winning selection for targets that previously fell through to their
      // name or glob defaults. That holds under an executor key with a
      // filter-less entry (a neutral carrier), and under a name or glob key
      // with a filter-less pin (a pinned carrier, which a same-name target of
      // another executor cannot inherit). An all-filtered array gets no
      // fallback: any carrier would widen the key. The object form has no
      // room to prepend; its single filter-less entry carries it instead.
      if (!suppliers.some((supplier) => !supplier.filter)) {
        const canCarry =
          key === PRUNE_LOCKFILE_EXECUTOR
            ? compatible.some((entry) => !entry.filter)
            : compatible.some(
                (entry) =>
                  !entry.filter && entry.executor === PRUNE_LOCKFILE_EXECUTOR
              );
        if (canCarry) {
          if (Array.isArray(value)) {
            const fallback: TargetDefaultArrayEntry =
              key === PRUNE_LOCKFILE_EXECUTOR
                ? {}
                : { executor: PRUNE_LOCKFILE_EXECUTOR };
            addRootSettingsInputs(fallback, config.rootInputs, []);
            value.unshift(fallback);
            defaultsChanged = true;
          } else {
            defaultsChanged =
              addRootSettingsInputs(value, config.rootInputs, []) ||
              defaultsChanged;
          }
        }
      }
    }
  }

  for (const projectName of changedProjects) {
    updateProjectConfiguration(tree, projectName, projects.get(projectName));
  }
  if (defaultsChanged) {
    updateNxJson(tree, nxJson);
  }
}

function declaresLockfile(
  outputs: TargetConfiguration['outputs'],
  lockFile: string
): boolean {
  return lockfileEntry(outputs, lockFile) !== undefined;
}

function lockfileEntry(
  outputs: TargetConfiguration['outputs'],
  lockFile: string
): string | undefined {
  return outputs?.find(
    (output): output is string =>
      typeof output === 'string' &&
      (output === lockFile || output.endsWith(`/${lockFile}`))
  );
}

/**
 * Adds the workspace root sources the artifacts are built from, skipping any
 * the target already hashes: a `'...'` in the owner's array can carry one in
 * from the layer below, where a check against the owner's own entries cannot
 * see it. An absent `inputs` means nx's own default, so that is spelled out
 * before adding to it rather than narrowing the configuration to the root
 * sources alone.
 */
function addRootSettingsInputs(
  config: TargetConfiguration,
  rootInputs: PruneLockfileCacheConfig['rootInputs'],
  referenceInputs: TargetConfiguration['inputs'] = []
): boolean {
  const alreadyHashed = namedFilesets(referenceInputs);
  const missing = rootInputs.filter((input) =>
    typeof input === 'string'
      ? !alreadyHashed.has(input) && !config.inputs?.includes(input)
      : !hasRuntimeInput(referenceInputs, input) &&
        !hasRuntimeInput(config.inputs, input)
  );
  if (missing.length === 0) {
    return false;
  }
  config.inputs = [...(config.inputs ?? DEFAULT_INPUTS), ...missing];
  return true;
}

/**
 * Whether a `targetDefaults` entry applies to `@nx/js:prune-lockfile` targets,
 * mirroring nx's runtime matching: the entry's `filter` and merge-time
 * payload compatibility are evaluated first, then the entry must sit under a
 * prune target's selected key and match its context. Entries locating the
 * executor (key, `executor` field, or `filter.executor`) match without a
 * concrete target so a defaults-only workspace still gets the update. The
 * in-key merge accumulation (identity replacement, outputs replacement, `...`
 * spreads) is deliberately not replicated: an entry the merge ends up
 * discarding for the prune target may still get the artifacts appended, which
 * is additive-only for the target's own replay.
 */
function appliesToPruneLockfileTargets(
  key: string,
  config: TargetDefaultArrayEntry,
  pruneTargets: KeyedTargetRef[]
): boolean {
  if (!entryIdentityCompatible(config)) {
    return false;
  }
  const filter = config.filter;
  if (pruneTargets.length === 0) {
    const locatesExecutor =
      key === PRUNE_LOCKFILE_EXECUTOR ||
      config.executor === PRUNE_LOCKFILE_EXECUTOR ||
      filter?.executor === PRUNE_LOCKFILE_EXECUTOR;
    return locatesExecutor && !filter?.projects;
  }
  return pruneTargets.some(
    ({ ref, selectedKey }) =>
      selectedKey === key &&
      readTargetDefaultsForTarget(
        ref.targetName,
        { [key]: [config] },
        ref.matcherExecutor,
        { projectName: ref.projectName, projectNode: ref.projectNode }
      ) !== null
  );
}

/**
 * Whether a `targetDefaults` entry can merge into an `@nx/js:prune-lockfile`
 * target at all: a filter or payload pinning another executor or a command
 * identity never does (isCompatibleTarget), and prune-lockfile targets are
 * always explicitly configured, never inferred, so a plugin-filtered entry
 * never applies either.
 */
function entryIdentityCompatible(config: TargetDefaultArrayEntry): boolean {
  const filter = config.filter;
  if (filter?.executor && filter.executor !== PRUNE_LOCKFILE_EXECUTOR) {
    return false;
  }
  if (filter?.plugin) {
    return false;
  }
  return !(
    (config.executor && config.executor !== PRUNE_LOCKFILE_EXECUTOR) ||
    config.command
  );
}

/**
 * Appends the artifacts next to an existing lockfile entry, reusing that
 * entry's own path spelling. Configurations with no `outputs` or no entry for
 * the lockfile are left alone: the lockfile entry is what identifies the
 * target as this package manager's, and one without `outputs` caches nothing
 * to begin with.
 */
function appendPruneOutputs(
  target: TargetConfiguration,
  config: PruneLockfileCacheConfig
): boolean {
  const entry = lockfileEntry(target.outputs, config.lockFile);
  if (!entry) {
    return false;
  }
  const prefix = entry.slice(0, -config.lockFile.length);
  let changed = false;
  for (const artifact of config.artifacts) {
    const output = `${prefix}${artifact}`;
    if (!target.outputs.includes(output)) {
      target.outputs.push(output);
      changed = true;
    }
  }
  return changed;
}
