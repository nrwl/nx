#!/usr/bin/env node

/**
 * Supply chain hardening: expands transitive dependencies of a package into
 * explicit, pinned direct dependencies in package.json.
 *
 * This ensures that `pnpm install nx@latest` produces a fully deterministic
 * install with zero resolver freedom — every package version is predetermined.
 *
 * Usage:
 *   npx ts-node scripts/expand-deps.ts --project nx
 *   npx ts-node scripts/expand-deps.ts --project nx --dry-run
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'yaml';

const workspaceRoot = join(__dirname, '..');

interface LockfileImporterDep {
  specifier: string;
  version: string;
}

interface LockfileSnapshot {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface Lockfile {
  importers: Record<
    string,
    {
      dependencies?: Record<string, LockfileImporterDep>;
      optionalDependencies?: Record<string, LockfileImporterDep>;
    }
  >;
  snapshots: Record<string, LockfileSnapshot>;
}

function parseArgs(): { project: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let project = '';
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      project = arg;
    }
  }

  if (!project) {
    console.error('Usage: expand-deps <project> [--dry-run]');
    process.exit(1);
  }

  return { project, dryRun };
}

/**
 * Strip peer dep qualifiers from a version string.
 * e.g. "1.15.11(debug@4.4.1)" -> "1.15.11"
 */
function stripPeerQualifier(version: string): string {
  const parenIndex = version.indexOf('(');
  return parenIndex === -1 ? version : version.substring(0, parenIndex);
}

/**
 * Build the snapshot lookup key for a package.
 * In the snapshots section, entries are keyed as "name@version" or
 * "name@version(peer-qualifiers)". We need to find the right entry.
 */
function findSnapshotEntry(
  snapshots: Record<string, LockfileSnapshot>,
  name: string,
  version: string
): LockfileSnapshot | null {
  // Try exact match first (name@version)
  const exactKey = `${name}@${version}`;
  if (snapshots[exactKey]) {
    return snapshots[exactKey];
  }

  // Look for entries with peer qualifiers (name@version(...))
  for (const key of Object.keys(snapshots)) {
    if (key === exactKey || key.startsWith(`${exactKey}(`)) {
      return snapshots[key];
    }
  }

  return null;
}

interface ConflictInfo {
  name: string;
  version1: string;
  path1: string[];
  version2: string;
  path2: string[];
}

function walkDeps(
  snapshots: Record<string, LockfileSnapshot>,
  name: string,
  version: string,
  resolved: Map<string, { version: string; path: string[] }>,
  conflicts: ConflictInfo[],
  currentPath: string[]
): void {
  const path = [...currentPath, `${name}@${version}`];

  // Check for conflicts
  const existing = resolved.get(name);
  if (existing) {
    if (existing.version === version) {
      return; // Already visited with same version
    }
    conflicts.push({
      name,
      version1: existing.version,
      path1: existing.path,
      version2: version,
      path2: path,
    });
    return;
  }

  resolved.set(name, { version, path });

  const snapshot = findSnapshotEntry(snapshots, name, version);
  if (!snapshot) {
    // Leaf dependency with no sub-deps (e.g. "cli-spinners@2.6.1: {}")
    return;
  }

  const deps = snapshot.dependencies || {};
  for (const [depName, depVersionRaw] of Object.entries(deps)) {
    const depVersion = stripPeerQualifier(depVersionRaw);
    walkDeps(snapshots, depName, depVersion, resolved, conflicts, path);
  }
}

function main() {
  const { project, dryRun } = parseArgs();

  const packageJsonPath = join(
    workspaceRoot,
    'packages',
    project,
    'package.json'
  );
  const lockfilePath = join(workspaceRoot, 'pnpm-lock.yaml');

  // Read package.json
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const originalDeps: Record<string, string> = packageJson.dependencies || {};
  const directDepNames = new Set(Object.keys(originalDeps));

  // Parse lockfile
  console.log('Parsing pnpm-lock.yaml...');
  const lockfileContent = readFileSync(lockfilePath, 'utf-8');
  const lockfile: Lockfile = yaml.parse(lockfileContent);

  // Find the importer entry for this package
  const importerKey = `packages/${project}`;
  const importer = lockfile.importers[importerKey];
  if (!importer) {
    console.error(
      `ERROR: No importer entry found for "${importerKey}" in pnpm-lock.yaml`
    );
    process.exit(1);
  }

  const importerDeps = importer.dependencies || {};

  // Resolve direct deps to their pinned versions from the lockfile
  const directDepsResolved = new Map<
    string,
    { specifier: string; resolvedVersion: string }
  >();
  for (const depName of directDepNames) {
    const importerDep = importerDeps[depName];
    if (!importerDep) {
      console.error(
        `ERROR: Direct dependency "${depName}" not found in lockfile importers section`
      );
      process.exit(1);
    }
    directDepsResolved.set(depName, {
      specifier: originalDeps[depName],
      resolvedVersion: stripPeerQualifier(importerDep.version),
    });
  }

  // Walk the full transitive dependency tree
  const resolved = new Map<string, { version: string; path: string[] }>();
  const conflicts: ConflictInfo[] = [];

  for (const [depName, { resolvedVersion }] of directDepsResolved) {
    walkDeps(
      lockfile.snapshots,
      depName,
      resolvedVersion,
      resolved,
      conflicts,
      []
    );
  }

  // Check for conflicts
  if (conflicts.length > 0) {
    console.error('\nERROR: Version conflicts detected:\n');
    for (const conflict of conflicts) {
      console.error(`  "${conflict.name}":`);
      console.error(`    Version ${conflict.version1}`);
      console.error(`      Path: ${conflict.path1.join(' -> ')}`);
      console.error(`    Version ${conflict.version2}`);
      console.error(`      Path: ${conflict.path2.join(' -> ')}`);
      console.error('');
    }
    console.error('Resolve manually before publishing.');
    process.exit(1);
  }

  // Build the expanded dependencies object
  const expandedDeps: Record<string, string> = {};
  const sortedNames = [...resolved.keys()].sort();
  for (const name of sortedNames) {
    expandedDeps[name] = resolved.get(name)!.version;
  }

  // Report
  console.log(`\nexpand-deps: ${project}\n`);

  // Direct deps changes
  console.log('Direct deps (resolved from lockfile):');
  for (const [depName, { specifier, resolvedVersion }] of directDepsResolved) {
    if (specifier === resolvedVersion) {
      console.log(`  ${depName}: ${resolvedVersion} (unchanged)`);
    } else {
      console.log(
        `  ${depName}: ${resolvedVersion} (was "${specifier}" — ${specifier.startsWith('catalog:') ? 'resolved' : 'pinned'})`
      );
    }
  }

  // New transitive deps
  const transitiveDeps = sortedNames.filter(
    (name) => !directDepNames.has(name)
  );
  console.log(`\nNew transitive deps to add (${transitiveDeps.length}):`);
  for (const name of transitiveDeps) {
    console.log(`  ${name}: ${resolved.get(name)!.version}`);
  }

  console.log(
    `\nTotal: ${directDepNames.size} direct -> ${resolved.size} total deps (${transitiveDeps.length} transitive added)`
  );

  if (dryRun) {
    console.log('\n--dry-run: no changes written.');
    return;
  }

  // Write back
  packageJson.dependencies = expandedDeps;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`\nWrote expanded dependencies to ${packageJsonPath}`);
}

main();
