import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Document, parseDocument, YAMLMap } from 'yaml';
import { gte } from 'semver';
import type { Tree } from '../generators/tree';
import { getPackageManagerVersion } from './package-manager';
import { readJsonFile } from './fileutils';

const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

/**
 * Records `allowBuilds` decisions in pnpm-workspace.yaml for build-script
 * dependencies that are about to be installed. pnpm 11+ refuses to install a
 * dependency whose build scripts are neither allowed nor denied, so the
 * generator or command that introduces such a dependency records the
 * decision up front.
 *
 * Comment-preserving. Existing entries are never overwritten, so user
 * decisions always win. No-op for non-pnpm workspaces and pnpm < 11 (which
 * warns instead of erroring and does not read `allowBuilds`).
 */
export function acknowledgePnpmBuildScripts(
  treeOrRoot: Tree | string,
  entries: Record<string, boolean>
): void {
  const host = createHost(treeOrRoot);
  if (!host.exists(PNPM_WORKSPACE_FILE)) {
    return;
  }
  const pnpmVersion = getPnpmVersion(host);
  if (!pnpmVersion || !gte(pnpmVersion, '11.0.0')) {
    return;
  }

  const parsed = parseDocument(host.read(PNPM_WORKSPACE_FILE));
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
    host.write(PNPM_WORKSPACE_FILE, doc.toString());
  }
}

interface Host {
  root: string;
  exists(path: string): boolean;
  read(path: string): string;
  write(path: string, content: string): void;
  readJson(path: string): any;
}

function createHost(treeOrRoot: Tree | string): Host {
  if (typeof treeOrRoot === 'string') {
    return {
      root: treeOrRoot,
      exists: (p) => existsSync(join(treeOrRoot, p)),
      read: (p) => readFileSync(join(treeOrRoot, p), 'utf-8'),
      write: (p, c) => writeFileSync(join(treeOrRoot, p), c),
      readJson: (p) => readJsonFile(join(treeOrRoot, p)),
    };
  }
  return {
    root: treeOrRoot.root,
    exists: (p) => treeOrRoot.exists(p),
    read: (p) => treeOrRoot.read(p, 'utf-8'),
    write: (p, c) => treeOrRoot.write(p, c),
    readJson: (p) => JSON.parse(treeOrRoot.read(p, 'utf-8')),
  };
}

function getPnpmVersion(host: Host): string | null {
  // The host's packageManager field wins: during workspace creation the
  // in-flight package.json only exists in the tree, not on disk.
  if (host.exists('package.json')) {
    const { packageManager } = host.readJson('package.json');
    if (
      typeof packageManager === 'string' &&
      packageManager.startsWith('pnpm@')
    ) {
      return packageManager.slice('pnpm@'.length);
    }
  }
  try {
    return getPackageManagerVersion('pnpm', host.root);
  } catch {
    // The version cannot be probed (e.g. pnpm is not on PATH). Leave the
    // workspace file untouched; pnpm's own install error remains actionable.
    return null;
  }
}
