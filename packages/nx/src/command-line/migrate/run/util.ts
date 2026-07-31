// Internal to run/: deliberately not re-exported from ./index.

import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';

const cachedPmExecPrefix = new Map<string, string>();

// getPackageManagerCommand can shell out to detect a version, so cache the
// result per root.
export function pmExecPrefix(root: string): string {
  let prefix = cachedPmExecPrefix.get(root);
  if (prefix === undefined) {
    prefix = getPackageManagerCommand(detectPackageManager(root), root).exec;
    cachedPmExecPrefix.set(root, prefix);
  }
  return prefix;
}
