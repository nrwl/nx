import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type TargetDefaults,
  type Tree,
} from '@nx/devkit';
import { readTargetDefaultsForTarget } from '@nx/devkit/internal';

const PRUNE_LOCKFILE_EXECUTOR = '@nx/js:prune-lockfile';
const PNPM_LOCKFILE = 'pnpm-lock.yaml';
// Artifacts the executor emits next to the pruned lockfile; without them in
// `outputs`, a cache replay restores only the manifest and the lockfile.
const PNPM_PRUNE_ARTIFACTS = [
  'pnpm-workspace.yaml',
  'patches',
  'local_path_modules',
];

interface PruneTargetRef {
  targetName: string;
  projectName: string;
  projectNode: ProjectGraphProjectNode;
  // the executor as the runtime matcher sees it: the target's own, undefined
  // when a matching default supplies it (defaults are read pre-merge)
  matcherExecutor: string | undefined;
}

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  const pruneTargets: PruneTargetRef[] = [];
  for (const [projectName, project] of getProjects(tree)) {
    const projectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: 'lib',
      data: { root: project.root, tags: project.tags },
    };
    let projectChanged = false;
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      // The executor may come from a matching targetDefaults entry rather
      // than the target itself. A `command` target resolves to nx:run-commands
      // before defaults apply, so a default can never make it a prune target.
      const executor =
        target.executor ??
        (target.command !== undefined
          ? 'nx:run-commands'
          : resolveDefaultsExecutor(
              targetName,
              projectName,
              projectNode,
              nxJson?.targetDefaults
            ));
      if (executor !== PRUNE_LOCKFILE_EXECUTOR) {
        continue;
      }
      pruneTargets.push({
        targetName,
        projectName,
        projectNode,
        matcherExecutor: target.executor,
      });
      projectChanged = appendPnpmPruneOutputs(target) || projectChanged;
    }
    if (!projectChanged) {
      continue;
    }
    updateProjectConfiguration(tree, projectName, project);
  }

  if (nxJson?.targetDefaults) {
    const targetDefaults = nxJson.targetDefaults;
    // runtime applies only the first key that resolves for a target
    // (executor, exact name, then longest glob), so anchor each prune target
    // to its selected key
    const selectedKeys = pruneTargets.map((ref) =>
      selectDefaultsKey(ref, targetDefaults)
    );
    let defaultsChanged = false;
    for (const [key, value] of Object.entries(targetDefaults)) {
      // a value may be the plain object form or the filtered array form
      for (const config of Array.isArray(value) ? value : [value]) {
        if (
          !appliesToPruneLockfileTargets(
            key,
            config,
            pruneTargets,
            selectedKeys
          )
        ) {
          continue;
        }
        defaultsChanged = appendPnpmPruneOutputs(config) || defaultsChanged;
      }
    }
    if (defaultsChanged) {
      updateNxJson(tree, nxJson);
    }
  }

  await formatFiles(tree);
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
  const ref: PruneTargetRef = {
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
    const identity =
      entry.command !== undefined ? 'nx:run-commands' : entry.executor;
    if (identity !== undefined) {
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
  ref: PruneTargetRef,
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
  pruneTargets: PruneTargetRef[],
  selectedKeys: (string | null)[]
): boolean {
  const filter = config.filter;
  if (
    filter?.executor !== undefined &&
    filter.executor !== PRUNE_LOCKFILE_EXECUTOR
  ) {
    return false;
  }
  // prune-lockfile targets are always explicitly configured, never inferred,
  // so they have no source plugin and a plugin-filtered entry never applies
  if (filter?.plugin !== undefined) {
    return false;
  }
  // merge-time compatibility (isCompatibleTarget) never merges an entry whose
  // payload pins another executor or a command identity into a prune target
  if (
    (config.executor !== undefined &&
      config.executor !== PRUNE_LOCKFILE_EXECUTOR) ||
    config.command !== undefined
  ) {
    return false;
  }
  if (pruneTargets.length === 0) {
    const locatesExecutor =
      key === PRUNE_LOCKFILE_EXECUTOR ||
      config.executor === PRUNE_LOCKFILE_EXECUTOR ||
      filter?.executor === PRUNE_LOCKFILE_EXECUTOR;
    return locatesExecutor && filter?.projects === undefined;
  }
  return pruneTargets.some(
    ({ targetName, projectName, projectNode, matcherExecutor }, index) =>
      selectedKeys[index] === key &&
      readTargetDefaultsForTarget(
        targetName,
        { [key]: [config] },
        matcherExecutor,
        { projectName, projectNode }
      ) !== null
  );
}

/**
 * Appends the pnpm prune artifacts next to an existing pnpm-lock.yaml entry,
 * reusing that entry's own path spelling. Targets with no `outputs` or no pnpm
 * lockfile entry are left alone.
 */
function appendPnpmPruneOutputs(target: TargetConfiguration): boolean {
  if (!target.outputs) {
    return false;
  }
  const lockfileEntry = target.outputs.find(
    (output) =>
      typeof output === 'string' &&
      (output === PNPM_LOCKFILE || output.endsWith(`/${PNPM_LOCKFILE}`))
  );
  if (!lockfileEntry) {
    return false;
  }
  const prefix = lockfileEntry.slice(0, -PNPM_LOCKFILE.length);
  let changed = false;
  for (const artifact of PNPM_PRUNE_ARTIFACTS) {
    const entry = `${prefix}${artifact}`;
    if (!target.outputs.includes(entry)) {
      target.outputs.push(entry);
      changed = true;
    }
  }
  return changed;
}
