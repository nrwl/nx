import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';
import type {
  TargetDefaultEntry,
  TargetDefaultsRecord,
} from '../../config/nx-json';
import { isGlobPattern } from '../../utils/globs';

/**
 * Converts the legacy record-shape `targetDefaults` in nx.json to the new
 * array shape introduced in Nx 23. No-op when `targetDefaults` is absent
 * or already an array.
 *
 * Record keys that look like executor strings (`pkg:name`, no glob chars)
 * convert to `{ executor: key, ... }`; everything else converts to
 * `{ target: key, ... }`. This preserves legacy semantics while producing
 * data that's honest about how the matcher will use it.
 */
export default async function convertTargetDefaultsToArray(
  tree: Tree
): Promise<void> {
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);
  if (!nxJson) return;

  const { targetDefaults } = nxJson;
  if (!targetDefaults) return;
  if (Array.isArray(targetDefaults)) return;

  const legacy = targetDefaults as TargetDefaultsRecord;
  const entries: TargetDefaultEntry[] = [];
  for (const key of Object.keys(legacy)) {
    const value = legacy[key] ?? {};
    entries.push(legacyKeyToEntry(key, value));
  }

  nxJson.targetDefaults = entries;
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

/**
 * Treat a legacy record key as an executor when it contains `:` and is
 * not a glob (executor strings are `pkg:name`; globs would also contain
 * `*` / `{` / etc., which `isGlobPattern` catches).
 */
export function isExecutorLikeKey(key: string): boolean {
  return key.includes(':') && !isGlobPattern(key);
}

function legacyKeyToEntry(
  key: string,
  value: Partial<TargetDefaultEntry>
): TargetDefaultEntry {
  if (isExecutorLikeKey(key)) {
    return { ...value, executor: key };
  }
  return { ...value, target: key };
}
