// Small helpers shared within run/. Not part of run/'s public surface (not
// re-exported via ./index): import directly within run/.

import {
  detectPackageManager,
  getPackageManagerCommand,
} from '../../../utils/package-manager';

// Migration package/name are user-authored; escape so a hostile value can't
// break out of an XML attribute.
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
