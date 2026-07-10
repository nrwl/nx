import { Document, parseDocument, YAMLMap } from 'yaml';
import { gte } from 'semver';
import type { Tree } from '../generators/tree';
import { readJson } from '../generators/utils/json';
import { getPackageManagerVersion } from './package-manager';

const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

/**
 * Records `allowBuilds` decisions in pnpm-workspace.yaml for build-script
 * dependencies a generator is about to add. pnpm 11+ refuses to install a
 * dependency whose build scripts are neither allowed nor denied, so the
 * generator that introduces such a dependency records the decision up front.
 *
 * Comment-preserving. Existing entries are never overwritten, so user
 * decisions always win. No-op for non-pnpm workspaces and pnpm < 11 (which
 * warns instead of erroring and does not read `allowBuilds`).
 */
export function acknowledgePnpmBuildScripts(
  tree: Tree,
  entries: Record<string, boolean>
): void {
  if (!tree.exists(PNPM_WORKSPACE_FILE)) {
    return;
  }
  const pnpmVersion = getPnpmVersion(tree);
  if (!pnpmVersion || !gte(pnpmVersion, '11.0.0')) {
    return;
  }

  const parsed = parseDocument(tree.read(PNPM_WORKSPACE_FILE, 'utf-8'));
  // A present root that isn't a mapping is malformed for pnpm; leave it alone
  // rather than replacing the user's content with just the allowBuilds key.
  if (parsed.contents != null && !(parsed.contents instanceof YAMLMap)) {
    return;
  }
  const doc =
    parsed.contents instanceof YAMLMap ? parsed : new Document(new YAMLMap());

  let changed = false;
  for (const [pkg, allowed] of Object.entries(entries)) {
    if (!doc.hasIn(['allowBuilds', pkg])) {
      doc.setIn(['allowBuilds', pkg], allowed);
      changed = true;
    }
  }
  if (changed) {
    tree.write(PNPM_WORKSPACE_FILE, doc.toString());
  }
}

function getPnpmVersion(tree: Tree): string | null {
  // The tree's packageManager field wins: during workspace creation the
  // in-flight package.json only exists in the tree, not on disk.
  if (tree.exists('package.json')) {
    const { packageManager } = readJson(tree, 'package.json');
    if (
      typeof packageManager === 'string' &&
      packageManager.startsWith('pnpm@')
    ) {
      return packageManager.slice('pnpm@'.length);
    }
  }
  try {
    return getPackageManagerVersion('pnpm', tree.root);
  } catch {
    // The version cannot be probed (e.g. pnpm is not on PATH). Leave the
    // workspace file untouched; pnpm's own install error remains actionable.
    return null;
  }
}
