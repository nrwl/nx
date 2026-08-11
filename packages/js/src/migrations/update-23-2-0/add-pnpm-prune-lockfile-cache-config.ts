import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type TargetDefaults,
  type Tree,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';

const PRUNE_LOCKFILE_EXECUTOR = '@nx/js:prune-lockfile';
const PNPM_LOCKFILE = 'pnpm-lock.yaml';
// Artifacts the executor emits next to the pruned lockfile; without them in
// `outputs`, a cache replay restores only the manifest and the lockfile.
const PNPM_PRUNE_ARTIFACTS = [
  'pnpm-workspace.yaml',
  'patches',
  'local_path_modules',
];
// The workspace root files those artifacts are built from. Neither the pnpm
// build approvals nor `supportedArchitectures` are recorded in the lockfile, so
// nothing else in the hash moves when they change.
const PNPM_ROOT_SETTINGS_SOURCES = [
  '{workspaceRoot}/pnpm-workspace.yaml',
  '{workspaceRoot}/package.json',
];
// what nx hashes for a target that declares no `inputs`
const DEFAULT_INPUTS = ['default', '^default'];

/** Everything the runtime's `targetDefaults` matcher needs to resolve a target. */
interface DefaultsMatchContext {
  targetName: string;
  projectName: string;
  projectNode: ProjectGraphProjectNode;
  // the executor as the runtime matcher sees it: the target's own, undefined
  // when a matching default supplies it (defaults are read pre-merge)
  matcherExecutor: string | undefined;
}

interface PruneTargetRef extends DefaultsMatchContext {
  target: TargetConfiguration;
}

/**
 * A prune target with the `targetDefaults` key the runtime would resolve for
 * it, carried together so the two cannot fall out of step.
 */
interface KeyedPruneTargetRef {
  ref: PruneTargetRef;
  selectedKey: string | null;
}

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  const targetDefaults = nxJson?.targetDefaults;
  const pruneTargets: PruneTargetRef[] = [];
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
              targetDefaults
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
      if (appendPnpmPruneOutputs(target)) {
        changedProjects.add(projectName);
      }
    }
  }

  let defaultsChanged = false;
  // runtime applies only the first key that resolves for a target (executor,
  // exact name, then longest glob), so anchor each prune target to its
  // selected key
  const keyedPruneTargets = pruneTargets.map<KeyedPruneTargetRef>((ref) => ({
    ref,
    selectedKey: targetDefaults ? selectDefaultsKey(ref, targetDefaults) : null,
  }));
  if (targetDefaults) {
    for (const [key, value] of Object.entries(targetDefaults)) {
      // a value may be the plain object form or the filtered array form
      for (const config of Array.isArray(value) ? value : [value]) {
        if (!appliesToPruneLockfileTargets(key, config, keyedPruneTargets)) {
          continue;
        }
        defaultsChanged = appendPnpmPruneOutputs(config) || defaultsChanged;
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
  // ends up with nothing to expand narrows the target to the two root files.
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
    // still a pnpm prune target.
    const effective = mergeTargetConfigurations(ref.target, defaults ?? {});
    if (!declaresPnpmLockfile(effective.outputs)) {
      continue;
    }
    const alreadyHashed = namedFilesets(effective.inputs);
    if (ref.target.inputs !== undefined) {
      // A target's own array wins outright, so nothing else can carry them.
      if (addRootSettingsInputs(ref.target, alreadyHashed)) {
        changedProjects.add(ref.projectName);
      }
      continue;
    }
    // Otherwise they belong to the entry supplying the array the target
    // inherits, which is the last one declaring `inputs`.
    const supplier = [...entries]
      .reverse()
      .find((entry) => entry.inputs !== undefined);
    if (supplier) {
      defaultsChanged =
        addRootSettingsInputs(supplier, alreadyHashed) || defaultsChanged;
    } else if (addRootSettingsInputs(ref.target, alreadyHashed)) {
      changedProjects.add(ref.projectName);
    }
  }
  // A workspace configuring its prune targets purely through `targetDefaults`
  // has no concrete target to carry the decision above.
  if (targetDefaults && pruneTargets.length === 0) {
    for (const [key, value] of Object.entries(targetDefaults)) {
      const entries = Array.isArray(value) ? value : [value];
      for (const config of entries) {
        if (
          !declaresPnpmLockfile(config.outputs) ||
          !appliesToPruneLockfileTargets(key, config, keyedPruneTargets)
        ) {
          continue;
        }
        defaultsChanged =
          addRootSettingsInputs(
            config,
            namedFilesets(entries.flatMap((entry) => entry.inputs ?? []))
          ) || defaultsChanged;
      }
    }
  }

  for (const projectName of changedProjects) {
    updateProjectConfiguration(tree, projectName, projects.get(projectName));
  }
  if (defaultsChanged) {
    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
}

/**
 * The `targetDefaults` entries under the selected key that survive nx's own
 * per-entry compatibility guard. Graph construction selects the key, then drops
 * each entry whose identity is incompatible with the target's *original* one and
 * keeps the compatible siblings (`createTargetDefaultsResults` in nx's
 * target-defaults). Reading the key unfiltered instead would let a
 * foreign-executor entry contribute outputs the target never gets.
 */
function compatibleDefaultsEntries(
  ref: PruneTargetRef,
  selectedKey: string | null,
  targetDefaults: TargetDefaults | undefined
): TargetDefaultArrayEntry[] {
  if (!targetDefaults || selectedKey === null) {
    return [];
  }
  const value = targetDefaults[selectedKey];
  return (Array.isArray(value) ? value : [value]).filter((entry) =>
    // `isCompatibleTarget` against the target's own executor. Falsy rather than
    // nullish, matching `resolveCommandSyntacticSugar` and `isCompatibleTarget`,
    // which read an empty string as no identity at all; an executor-less target
    // has no identity to clash with, so every entry survives, as it does there.
    !ref.matcherExecutor
      ? true
      : !entry.command &&
        (!entry.executor || entry.executor === ref.matcherExecutor)
  );
}

function declaresPnpmLockfile(
  outputs: TargetConfiguration['outputs']
): boolean {
  return pnpmLockfileEntry(outputs) !== undefined;
}

function pnpmLockfileEntry(
  outputs: TargetConfiguration['outputs']
): string | undefined {
  return outputs?.find(
    (output): output is string =>
      typeof output === 'string' &&
      (output === PNPM_LOCKFILE || output.endsWith(`/${PNPM_LOCKFILE}`))
  );
}

/**
 * Adds the workspace root files the pnpm install settings live in, skipping any
 * the target already hashes: a `'...'` in the owner's array can carry one in
 * from the layer below, where a check against the owner's own entries cannot see
 * it. An absent `inputs` means nx's own default, so that is spelled out before
 * adding to it rather than narrowing the configuration to those two files.
 */
function addRootSettingsInputs(
  config: TargetConfiguration,
  alreadyHashed: ReadonlySet<string> = new Set()
): boolean {
  const missing = PNPM_ROOT_SETTINGS_SOURCES.filter(
    (source) => !alreadyHashed.has(source) && !config.inputs?.includes(source)
  );
  if (missing.length === 0) {
    return false;
  }
  config.inputs = [...(config.inputs ?? DEFAULT_INPUTS), ...missing];
  return true;
}

/** The plain filesets an inputs array names, for a containment check. */
function namedFilesets(
  inputs: TargetConfiguration['inputs']
): ReadonlySet<string> {
  return new Set(
    (inputs ?? []).filter((input): input is string => typeof input === 'string')
  );
}

/**
 * The executor an executor-less target ends up with after its selected
 * defaults key applies. Each matching entry's identity is resolved like the
 * runtime does at merge time: a `command` payload means nx:run-commands, and
 * a later entry's identity replaces an earlier, incompatible one (the reader's
 * merged view keeps the first executor instead, so it cannot be used here).
 */
function resolveDefaultsExecutor(
  targetName: string,
  projectName: string,
  projectNode: ProjectGraphProjectNode,
  targetDefaults: TargetDefaults | undefined
): string | undefined {
  if (!targetDefaults) {
    return undefined;
  }
  const ref: DefaultsMatchContext = {
    targetName,
    projectName,
    projectNode,
    matcherExecutor: undefined,
  };
  const key = selectDefaultsKey(ref, targetDefaults);
  if (key === null) {
    return undefined;
  }
  // like the runtime merge, a later matching entry's identity (a `command`
  // payload means nx:run-commands) replaces an earlier, incompatible one
  const value = targetDefaults[key];
  let executor: string | undefined;
  for (const entry of Array.isArray(value) ? value : [value]) {
    if (
      readTargetDefaultsForTarget(targetName, { [key]: [entry] }, undefined, {
        projectName,
        projectNode,
      }) === null
    ) {
      continue;
    }
    const identity = entry.command ? 'nx:run-commands' : entry.executor;
    if (identity) {
      executor = identity;
    }
  }
  return executor;
}

/**
 * The `targetDefaults` key nx's runtime would select for this target: keys
 * are tried as the executor key, the exact-name key, then glob keys longest
 * first, and the first whose entries produce a match wins; the rest are
 * shadowed. Resolution per key goes through nx's own reader. Non-matching
 * keys never resolve, so sorting all remaining keys by length stands in for
 * the runtime's glob-only ordering.
 */
function selectDefaultsKey(
  ref: DefaultsMatchContext,
  targetDefaults: TargetDefaults
): string | null {
  const resolves = (key: string) =>
    readTargetDefaultsForTarget(
      ref.targetName,
      { [key]: targetDefaults[key] },
      ref.matcherExecutor,
      { projectName: ref.projectName, projectNode: ref.projectNode }
    ) !== null;
  if (
    targetDefaults[PRUNE_LOCKFILE_EXECUTOR] &&
    resolves(PRUNE_LOCKFILE_EXECUTOR)
  ) {
    return PRUNE_LOCKFILE_EXECUTOR;
  }
  if (
    targetDefaults[ref.targetName] &&
    ref.targetName !== PRUNE_LOCKFILE_EXECUTOR &&
    resolves(ref.targetName)
  ) {
    return ref.targetName;
  }
  const globCandidates = Object.keys(targetDefaults)
    .filter((key) => key !== PRUNE_LOCKFILE_EXECUTOR && key !== ref.targetName)
    .sort((a, b) => b.length - a.length);
  for (const key of globCandidates) {
    if (resolves(key)) {
      return key;
    }
  }
  return null;
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
  pruneTargets: KeyedPruneTargetRef[]
): boolean {
  const filter = config.filter;
  if (filter?.executor && filter.executor !== PRUNE_LOCKFILE_EXECUTOR) {
    return false;
  }
  // prune-lockfile targets are always explicitly configured, never inferred,
  // so they have no source plugin and a plugin-filtered entry never applies
  if (filter?.plugin) {
    return false;
  }
  // merge-time compatibility (isCompatibleTarget) never merges an entry whose
  // payload pins another executor or a command identity into a prune target
  if (
    (config.executor && config.executor !== PRUNE_LOCKFILE_EXECUTOR) ||
    config.command
  ) {
    return false;
  }
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
 * Appends the pnpm prune artifacts next to an existing pnpm-lock.yaml entry,
 * reusing that entry's own path spelling. Configurations with no `outputs` or no
 * pnpm lockfile entry are left alone: the lockfile entry is what identifies the
 * target as pnpm's, and one without `outputs` caches nothing to begin with.
 */
function appendPnpmPruneOutputs(config: TargetConfiguration): boolean {
  const lockfileEntry = pnpmLockfileEntry(config.outputs);
  if (!lockfileEntry) {
    return false;
  }
  const prefix = lockfileEntry.slice(0, -PNPM_LOCKFILE.length);
  let changed = false;
  for (const artifact of PNPM_PRUNE_ARTIFACTS) {
    const entry = `${prefix}${artifact}`;
    if (!config.outputs.includes(entry)) {
      config.outputs.push(entry);
      changed = true;
    }
  }
  return changed;
}
