import type { TargetDefaults, TargetDefaultValue } from '../../config/nx-json';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import {
  getProjects,
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';

/**
 * Target defaults resolve to a single key rather than merging, so an executor
 * key hides the target name key entirely. Before Nx 23 a shadowed
 * `cache: true` still took effect, because cacheability was also derived from
 * target *names* via `cacheableOperations`; Nx 23 removed that derivation and
 * those targets silently stopped being cacheable.
 *
 * Write the intent into the executor key so it no longer depends on the
 * deprecated fallback that restores the old behavior at runtime.
 */
export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);
  const targetDefaults = nxJson?.targetDefaults;
  if (!targetDefaults) {
    return;
  }

  // `cache` on an executor key reaches every target that resolves through it,
  // not just the one whose target name key enables caching. Collect all of them
  // per key so the decision below can be made for the key as a whole.
  const targetNamesByExecutorKey = new Map<string, Set<string>>();
  for (const [, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (!target.executor || !targetDefaults[target.executor]) {
        continue;
      }
      const targetNames =
        targetNamesByExecutorKey.get(target.executor) ?? new Set();
      targetNames.add(targetName);
      targetNamesByExecutorKey.set(target.executor, targetNames);
    }
  }

  let changed = false;
  for (const [key, targetNames] of targetNamesByExecutorKey) {
    if (!canEnableCache(targetDefaults, key, targetNames)) {
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
 * The executor key outranks every target name key, so stamping it caches every
 * one of `targetNames` — including a `serve` that would then be both cacheable
 * and continuous, which makes `nx.json` fail graph construction outright. The
 * key is only safe when every target through it independently wants caching.
 * Anything else is left to the runtime fallback, which decides per target.
 */
function canEnableCache(
  targetDefaults: TargetDefaults,
  key: string,
  targetNames: Set<string>
): boolean {
  // Already decided; never override the user's value.
  if (declaredCache(targetDefaults[key]) !== undefined) {
    return false;
  }
  // Only an unfiltered entry can be amended. Appending a catch-all to an
  // all-filtered key would make it match targets that previously fell through
  // to the target name key, silently dropping that key's `dependsOn`/`inputs`.
  if (!catchAllConfig(targetDefaults[key])) {
    return false;
  }
  for (const targetName of targetNames) {
    if (declaredCache(targetDefaults[targetName]) !== true) {
      return false;
    }
    if (isLongRunningTargetName(targetName)) {
      return false;
    }
  }
  return true;
}

/**
 * The `cache` a `targetDefaults` value declares, or undefined when it declares
 * none. Mirrors {@link isLegacyCachedTarget} in `target-normalization.ts`: a
 * filtered entry declaring `cache` makes the value unknowable without project
 * context, so it reads as "declared" and blocks the rewrite.
 */
function declaredCache(
  value: TargetDefaultValue | undefined
): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const entries = Array.isArray(value) ? value : [value];
  let declared: boolean | undefined;
  for (const entry of entries) {
    if (entry.cache === undefined) continue;
    // Unknowable here, so treat it as decided and leave the value alone.
    if (entry.filter) return entry.cache;
    declared = entry.cache;
  }
  return declared;
}

/**
 * The unfiltered config block of a `targetDefaults` value, or undefined when the
 * array form carries only filtered entries. Never creates one — see
 * {@link canEnableCache}.
 */
function catchAllConfig(
  value: TargetDefaultValue
): TargetConfiguration | undefined {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.find((entry) => entry.filter === undefined);
}

/**
 * Target names the pre-23 `longRunningTask` guard excluded from caching. Mirrors
 * `isLongRunningTarget` in `target-normalization.ts`; `continuous` is not
 * checked because it is resolved from the executor schema at graph construction
 * and is not readable from `project.json` here.
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
