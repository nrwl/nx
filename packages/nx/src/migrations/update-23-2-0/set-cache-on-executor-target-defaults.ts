import type { TargetDefaults, TargetDefaultValue } from '../../config/nx-json';
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

  // Only executor keys that a real target actually resolves through — an
  // unused executor key shadowed nothing, and adding `cache` to it would
  // change behavior rather than preserve it.
  const shadowingKeys = new Set<string>();
  for (const [, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (!target.executor || !targetDefaults[target.executor]) {
        continue;
      }
      if (declaredCache(targetDefaults[target.executor]) !== undefined) {
        continue;
      }
      if (declaredCache(targetDefaults[targetName]) === true) {
        shadowingKeys.add(target.executor);
      }
    }
  }

  if (shadowingKeys.size === 0) {
    return;
  }

  for (const key of shadowingKeys) {
    enableCache(targetDefaults, key);
  }
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

/**
 * The `cache` a `targetDefaults` value declares, or undefined when it declares
 * none. Mirrors how the runtime fallback reads a value: filtered entries need
 * project context that isn't available here, so only catch-all entries count,
 * and later entries win.
 */
function declaredCache(
  value: TargetDefaultValue | undefined
): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const entries = Array.isArray(value) ? value : [value];
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].filter) continue;
    if (entries[i].cache !== undefined) return entries[i].cache;
  }
  return undefined;
}

/** Sets `cache: true` on whichever entry {@link declaredCache} would read. */
function enableCache(targetDefaults: TargetDefaults, key: string) {
  const value = targetDefaults[key];
  if (!Array.isArray(value)) {
    value.cache = true;
    return;
  }

  for (let i = value.length - 1; i >= 0; i--) {
    if (!value[i].filter) {
      value[i].cache = true;
      return;
    }
  }
  // Every entry is filtered, so there is no catch-all to amend.
  value.push({ cache: true });
}
