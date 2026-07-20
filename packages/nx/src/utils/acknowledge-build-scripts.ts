import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseDocument, YAMLMap } from 'yaml';
import { gte } from 'semver';
import type { Tree } from '../generators/tree';
import type { PackageManager } from './package-manager';
import {
  getPackageManagerVersion,
  parseVersionFromPackageManagerField,
} from './package-manager';
import { readJsonFile } from './fileutils';

const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';

/**
 * Records build-script decisions for dependencies that are about to be
 * installed, in whatever form the given package manager understands.
 *
 * Only pnpm needs this today: pnpm 11+ refuses to install a dependency whose
 * build scripts are neither allowed nor denied, so the generator or command
 * that introduces such a dependency records the decision up front. Other
 * package managers run build scripts unconditionally, so this is a no-op for
 * them.
 */
export function acknowledgeBuildScripts(
  treeOrRoot: Tree | string,
  packageManager: PackageManager,
  entries: Record<string, boolean>
): void {
  if (packageManager !== 'pnpm') {
    return;
  }
  acknowledgePnpmBuildScripts(treeOrRoot, entries);
}

/**
 * Records `allowBuilds` decisions in pnpm-workspace.yaml, creating the file
 * when missing (mirroring `pnpm approve-builds` in single-package repos).
 *
 * Comment-preserving. Existing entries are never overwritten, so user
 * decisions always win. No-op for pnpm < 11, which warns instead of erroring
 * and does not read `allowBuilds`.
 */
function acknowledgePnpmBuildScripts(
  treeOrRoot: Tree | string,
  entries: Record<string, boolean>
): void {
  const host = createHost(treeOrRoot);
  const pnpmVersion = getPnpmVersion(host);
  if (!pnpmVersion || !gte(pnpmVersion, '11.0.0')) {
    return;
  }

  const parsed = parseDocument(
    host.exists(PNPM_WORKSPACE_FILE) ? host.read(PNPM_WORKSPACE_FILE) : ''
  );
  // A file that doesn't parse cleanly or whose root isn't a mapping is
  // malformed for pnpm; leave it alone rather than crashing or replacing the
  // user's content. pnpm's own error on the file is the actionable signal.
  // Empty and comment-only files have no contents at all; setIn creates the
  // mapping for them while keeping whatever comments they carry.
  if (
    parsed.errors.length > 0 ||
    (parsed.contents != null && !(parsed.contents instanceof YAMLMap))
  ) {
    return;
  }

  let changed = false;
  for (const [pkg, allowed] of Object.entries(entries)) {
    // Only a real boolean is a user decision. pnpm's non-strict installs stub
    // undecided packages with a placeholder string ("set this to true or
    // false"), which would fail the next strict install if left in place.
    if (typeof parsed.getIn(['allowBuilds', pkg]) !== 'boolean') {
      parsed.setIn(['allowBuilds', pkg], allowed);
      changed = true;
    }
  }
  if (changed) {
    host.write(PNPM_WORKSPACE_FILE, parsed.toString());
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
    const version = parseVersionFromPackageManagerField(
      'pnpm',
      typeof packageManager === 'string' ? packageManager : undefined
    );
    if (version) {
      return version;
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
