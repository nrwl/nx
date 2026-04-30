import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { Tree } from '../../generators/tree';
import type {
  TargetDefaultEntry,
  TargetDefaultsRecord,
} from '../../config/nx-json';

/**
 * Converts the legacy record-shape `targetDefaults` in nx.json to the new
 * array shape introduced in Nx 23. No-op when `targetDefaults` is absent
 * or already an array.
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
    entries.push({ ...value, target: key });
  }

  nxJson.targetDefaults = entries;
  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
