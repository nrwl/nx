import type { Tree } from '../../generators/tree';
import update from '../update-22-0-0/consolidate-release-tag-config';

/**
 * The deprecated releaseTag* flat properties were removed in Nx 23. Re-run the
 * v22 consolidation for any workspaces that still have the legacy keys (e.g.,
 * configs added manually after the v22 migration ran). Runs automatically as
 * part of `nx migrate` and is also triggered by `nx repair` when the runtime
 * detects legacy keys still present in `nx.json`.
 */
// TODO(v24): remove this migration (along with its registration in
// migrations.json) and the LEGACY_RELEASE_TAG_PATTERN_PROPERTIES_DETECTED
// runtime error path in packages/nx/src/command-line/release/config/config.ts.
export default async function (tree: Tree) {
  return update(tree);
}
