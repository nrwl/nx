import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { join } from 'node:path/posix';

import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
} from '../../plugins/package-json/create-nodes';
import { readJsonFile, readYamlFile } from '../../utils/fileutils';
import { multiGlobWithWorkspaceContext } from '../../utils/workspace-context';

export interface WorkspacePackageNames {
  names: string[];
  version: number;
}

// Sources of the package manager workspace globs. A rescan parses each with
// its own reader first, since the pattern builder swallows a parse error.
const PATTERN_SOURCES = new Map<string, (path: string) => unknown>([
  ['package.json', readJsonFile],
  ['pnpm-workspace.yaml', readYamlFile],
  ['lerna.json', readJsonFile],
]);

let packageJsonToName: Map<string, string> | null = null;
// Two manifests may share a name; the name stays while either exists.
let nameCounts = new Map<string, number>();
let matcher: ((packageJsonPath: string) => boolean) | null = null;
// Never reset: workers compare versions across a rescan.
let current: WorkspacePackageNames = { names: [], version: 0 };

/**
 * Maintains the package-manager workspace package names from the daemon's
 * file changes so source graphs see a package before the hooks that import
 * it run. Rescans the manifests when a workspace glob source changed; returns
 * null when that rescan lost to a newer recomputation.
 */
export async function updateWorkspacePackageNames(
  root: string,
  updatedFiles: string[],
  deletedFiles: string[],
  isCurrent: () => boolean
): Promise<WorkspacePackageNames | null> {
  const changedFiles = [...updatedFiles, ...deletedFiles];
  if (
    !packageJsonToName ||
    changedFiles.some((file) => PATTERN_SOURCES.has(file))
  ) {
    const scanned = await scan(root);
    if (!isCurrent()) {
      return null;
    }
    // An unreadable file keeps the previous set; the next compute rescans.
    if (!scanned) {
      packageJsonToName = null;
      return current;
    }
    ({ packageJsonToName, matcher } = scanned);
    nameCounts = new Map();
    for (const name of packageJsonToName.values()) {
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    }
    const known = new Set(current.names);
    return publish(
      nameCounts.size !== known.size ||
        [...nameCounts.keys()].some((name) => !known.has(name))
    );
  }

  // Read every changed manifest before touching the map so a malformed file
  // leaves the set as it was. The batch is drained anyway, so rescan next.
  const additions: Array<[string, string | undefined]> = [];
  for (const file of updatedFiles) {
    if (basename(file) !== 'package.json' || !matcher(file)) {
      continue;
    }
    const name = readPackageName(root, file);
    if (name === null) {
      packageJsonToName = null;
      return current;
    }
    additions.push([file, name]);
  }
  // Only a name that appears or disappears over the whole batch counts; a
  // rename swap or a directory move changes nothing.
  const touched = new Set<string>();
  const present = (name: string) => nameCounts.has(name);
  for (const file of deletedFiles) {
    if (basename(file) === 'package.json' && packageJsonToName.has(file)) {
      touched.add(packageJsonToName.get(file));
    }
  }
  for (const [file, name] of additions) {
    if (packageJsonToName.has(file)) {
      touched.add(packageJsonToName.get(file));
    }
    if (name) {
      touched.add(name);
    }
  }
  const before = new Set([...touched].filter(present));
  for (const file of deletedFiles) {
    if (basename(file) === 'package.json') {
      remove(file);
    }
  }
  for (const [file, name] of additions) {
    if (packageJsonToName.get(file) === name) {
      continue;
    }
    remove(file);
    if (name) {
      packageJsonToName.set(file, name);
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    }
  }
  return publish(
    [...touched].some((name) => present(name) !== before.has(name))
  );
}

/** Forgets the manifests so the next update rescans. */
export function resetWorkspacePackageNames(): void {
  packageJsonToName = null;
  matcher = null;
}

function remove(file: string): void {
  const name = packageJsonToName.get(file);
  if (name === undefined) {
    return;
  }
  packageJsonToName.delete(file);
  const count = nameCounts.get(name) - 1;
  if (count > 0) {
    nameCounts.set(name, count);
  } else {
    nameCounts.delete(name);
  }
}

// The manifests the package-json plugin turns into workspace packages, found
// without loading plugins. Null when a manifest or glob source cannot be read.
async function scan(root: string): Promise<{
  packageJsonToName: Map<string, string>;
  matcher: (packageJsonPath: string) => boolean;
} | null> {
  for (const [file, read] of PATTERN_SOURCES) {
    const path = join(root, file);
    try {
      if (existsSync(path)) {
        read(path);
      }
    } catch {
      return null;
    }
  }
  const patterns = buildPackageJsonPatterns(root, (path) =>
    readJsonFile(join(root, path))
  );
  const matcher = buildPackageJsonWorkspacesMatcher(patterns);
  const packageJsonToName = new Map<string, string>();
  const files = (
    await multiGlobWithWorkspaceContext(root, patterns.positive)
  ).flat();
  for (const file of new Set(files)) {
    if (!matcher(file)) {
      continue;
    }
    const name = readPackageName(root, file);
    if (name === null) {
      return null;
    }
    if (name) {
      packageJsonToName.set(file, name);
    }
  }
  return { packageJsonToName, matcher };
}

// undefined when the manifest has no name, null when it cannot be read.
function readPackageName(
  root: string,
  file: string
): string | undefined | null {
  try {
    return readJsonFile<{ name?: string }>(join(root, file)).name;
  } catch {
    return null;
  }
}

function publish(changed: boolean): WorkspacePackageNames {
  if (changed) {
    current = { names: [...nameCounts.keys()], version: current.version + 1 };
  }
  return current;
}
