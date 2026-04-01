import { readNxJson } from '../../../../config/configuration';
import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import {
  FileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import { isJsonChange, JsonChange } from '../../../../utils/json-diff';
import { jsPluginConfig as readJsPluginConfig } from '../../utils/config';
import { findMatchingProjects } from '../../../../utils/find-matching-projects';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { logger } from '../../../../utils/logger';

type ChangedPackagesResolver = (changes: JsonChange[]) => string[] | null;

/**
 * Maps every supported lock file to a function that extracts changed
 * package names from its JSON-level changes. Adding a new lock file
 * here automatically includes it in detection -- no separate list to
 * keep in sync.
 *
 * Each resolver returns an array of package names that changed, or null
 * when the format cannot identify specific packages (meaning all
 * projects should be considered affected).
 */
const LOCK_FILE_RESOLVERS = {
  'pnpm-lock.yaml': getChangedPackagesFromPnpmLock,
  'pnpm-lock.yml': getChangedPackagesFromPnpmLock,
  'package-lock.json': getChangedPackagesFromNpmLock,
  'yarn.lock': getChangedPackagesFromYarnLock,
  'bun.lockb': getChangedPackagesFromBunLock,
  'bun.lock': getChangedPackagesFromBunLock,
} satisfies Record<string, ChangedPackagesResolver>;

type SupportedLockFile = keyof typeof LOCK_FILE_RESOLVERS;

function isSupportedLockFile(file: string): file is SupportedLockFile {
  return file in LOCK_FILE_RESOLVERS;
}

const ALL_LOCK_FILES = Object.keys(LOCK_FILE_RESOLVERS);

export const getTouchedProjectsFromLockFile: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (
  fileChanges,
  projectGraphNodes,
  _nxJson,
  _packageJson,
  projectGraph
): string[] => {
  const nxJson = readNxJson();
  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);

  const changedLockFile = fileChanges.find((f) =>
    ALL_LOCK_FILES.includes(f.file)
  );

  if (projectsAffectedByDependencyUpdates === 'auto') {
    return getAutoAffected(changedLockFile, projectGraphNodes, projectGraph);
  } else if (Array.isArray(projectsAffectedByDependencyUpdates)) {
    return findMatchingProjects(
      projectsAffectedByDependencyUpdates,
      projectGraphNodes
    );
  }

  if (changedLockFile) {
    return Object.values(projectGraphNodes).map((p) => p.name);
  }
  return [];
};

/**
 * In auto mode, extract changed package names from the lock file diff,
 * then use the project graph's dependency edges to find which workspace
 * projects (and external nodes) are affected.
 *
 * Returns external node names (e.g. "npm:lodash@4.17.21") so the
 * graph reversal in filterAffected can walk back to workspace projects.
 */
function getAutoAffected(
  changedLockFile: FileChange<WholeFileChange | JsonChange> | undefined,
  projectGraphNodes: Record<string, ProjectGraphProjectNode>,
  projectGraph: ProjectGraph
): string[] {
  const allProjectNames = Object.values(projectGraphNodes).map((p) => p.name);

  if (!changedLockFile) {
    return [];
  }

  const changedPackageNames = getChangedPackageNames(changedLockFile);
  if (changedPackageNames === null) {
    return allProjectNames;
  }

  if (!changedPackageNames.length) {
    return [];
  }

  // Look up the changed packages in the project graph's external nodes
  // and return the external node names. The graph reversal in
  // filterAffected walks from these nodes to workspace projects.
  const externalNodes = projectGraph?.externalNodes ?? {};
  const touchedNodeNames = findExternalNodesByPackageName(
    changedPackageNames,
    externalNodes
  );

  // If we found matching external nodes, return them so the graph
  // reversal can identify affected workspace projects.
  if (touchedNodeNames.length > 0) {
    return touchedNodeNames;
  }

  // Changed packages weren't found in external nodes -- they may have
  // been removed or the graph may not include them. Fall back to
  // marking all projects as affected.
  return allProjectNames;
}

/**
 * Given a list of package names, find all matching external node names
 * in the project graph.
 */
function findExternalNodesByPackageName(
  packageNames: string[],
  externalNodes: Record<string, ProjectGraphExternalNode>
): string[] {
  const packageNameSet = new Set(packageNames);
  const nodeNames: string[] = [];
  for (const [name, node] of Object.entries(externalNodes)) {
    if (packageNameSet.has(node.data.packageName)) {
      nodeNames.push(name);
    }
  }
  return nodeNames;
}

/**
 * Extract changed package names from a lock file's JSON diff.
 *
 * Returns null when the changes cannot be narrowed to specific packages
 * (meaning all projects should be considered affected).
 */
function getChangedPackageNames(
  changedLockFile: FileChange<WholeFileChange | JsonChange>
): string[] | null {
  const changes = changedLockFile.getChanges();

  // If any change is a WholeFileChange we cannot determine which
  // specific packages are affected, so signal "all projects".
  if (changes.some((c) => !isJsonChange(c))) {
    return null;
  }

  if (!isSupportedLockFile(changedLockFile.file)) {
    logger.warn(
      `Unsupported lock file "${changedLockFile.file}" for projectsAffectedByDependencyUpdates "auto" mode. All projects will be marked as affected.`
    );
    return null;
  }

  return LOCK_FILE_RESOLVERS[changedLockFile.file](
    changes.filter(isJsonChange)
  );
}

// ---------------------------------------------------------------------------
// Per-format resolvers: extract changed package names from JSON diffs
// ---------------------------------------------------------------------------

/**
 * pnpm-lock.yaml structure:
 *   importers:
 *     <project-path>:
 *       dependencies:
 *         <package-name>:
 *           version: ...
 *   packages:
 *     <pkg-key>:
 *       ...
 *
 * Changes in the "importers" section reference direct dependencies by name.
 * Changes in the "packages" section reference resolved dependency keys.
 */
function getChangedPackagesFromPnpmLock(changes: JsonChange[]): string[] {
  const packages = new Set<string>();
  for (const change of changes) {
    if (change.path[0] === 'importers' && change.path.length >= 4) {
      // importers/<project>/<depType>/<packageName>/...
      packages.add(change.path[3]);
    } else if (change.path[0] === 'packages' && change.path.length >= 2) {
      // packages/<pkgKey>/... -- extract package name from the key
      // pnpm keys look like: "/@scope/name@version" or "/name@version"
      const pkgName = extractPackageNameFromPnpmKey(change.path[1]);
      if (pkgName) {
        packages.add(pkgName);
      }
    }
  }
  return Array.from(packages);
}

/**
 * Extract a package name from a pnpm packages key.
 * Keys look like: "/@scope/name@version" or "/name@version" (pnpm v6+)
 * or "@scope/name@version" or "name@version" (varies by pnpm version)
 */
function extractPackageNameFromPnpmKey(key: string): string | null {
  if (typeof key !== 'string') return null;
  // Strip leading slash if present
  const normalized = key.startsWith('/') ? key.substring(1) : key;
  if (!normalized) return null;

  // For scoped packages: @scope/name@version
  if (normalized.startsWith('@')) {
    const secondAt = normalized.indexOf('@', 1);
    if (secondAt > 0) {
      return normalized.substring(0, secondAt);
    }
    // No version suffix -- return as-is
    return normalized;
  }

  // For unscoped packages: name@version
  const atIndex = normalized.indexOf('@');
  if (atIndex > 0) {
    return normalized.substring(0, atIndex);
  }
  return normalized;
}

/**
 * package-lock.json (v2/v3) structure:
 *   packages:
 *     "<path>/node_modules/<pkg>":
 *       version: ...
 *     "node_modules/<pkg>":
 *       version: ...
 *
 * Extract the package name from the node_modules path segment.
 */
function getChangedPackagesFromNpmLock(changes: JsonChange[]): string[] {
  const packages = new Set<string>();
  for (const change of changes) {
    if (change.path[0] === 'packages' && typeof change.path[1] === 'string') {
      const pkgName = extractPackageNameFromNpmPath(change.path[1]);
      if (pkgName) {
        packages.add(pkgName);
      }
    }
  }
  return Array.from(packages);
}

/**
 * Extract a package name from an npm packages path.
 * Paths look like: "node_modules/lodash" or "libs/app1/node_modules/@scope/pkg"
 * We want the last node_modules segment's package name.
 */
function extractPackageNameFromNpmPath(path: string): string | null {
  const lastNmIndex = path.lastIndexOf('node_modules/');
  if (lastNmIndex < 0) return null;
  const afterNm = path.substring(lastNmIndex + 'node_modules/'.length);
  if (!afterNm) return null;
  // For scoped packages, the name includes the scope: @scope/pkg
  // The path would be "node_modules/@scope/pkg"
  return afterNm;
}

/**
 * yarn.lock is a flat map of "package@range" -> metadata.
 * Extract the package name from each changed key.
 */
function getChangedPackagesFromYarnLock(changes: JsonChange[]): string[] {
  const packages = new Set<string>();
  for (const change of changes) {
    if (change.path.length >= 1 && typeof change.path[0] === 'string') {
      const pkgName = extractPackageNameFromYarnKey(change.path[0]);
      if (pkgName) {
        packages.add(pkgName);
      }
    }
  }
  return Array.from(packages);
}

/**
 * Extract a package name from a yarn.lock key.
 * Keys look like: "lodash@^4.17.0" or "@scope/pkg@^1.0.0"
 * May also have comma-separated entries: "lodash@^4.17.0, lodash@~4.17.0"
 */
function extractPackageNameFromYarnKey(key: string): string | null {
  // Take the first entry if comma-separated
  const firstEntry = key.split(',')[0].trim();
  if (!firstEntry) return null;

  // For scoped packages: @scope/name@range
  if (firstEntry.startsWith('@')) {
    const secondAt = firstEntry.indexOf('@', 1);
    if (secondAt > 0) {
      return firstEntry.substring(0, secondAt);
    }
    return firstEntry;
  }

  // For unscoped packages: name@range
  const atIndex = firstEntry.indexOf('@');
  if (atIndex > 0) {
    return firstEntry.substring(0, atIndex);
  }
  return firstEntry;
}

/**
 * bun.lock structure:
 *   workspaces:
 *     <project-path>:
 *       dependencies:
 *         <package-name>: ...
 *   packages:
 *     <pkg-key>: [...]
 *
 * Changes in "workspaces" reference direct dependencies by name.
 * Changes in "packages" reference resolved dependency keys.
 */
function getChangedPackagesFromBunLock(changes: JsonChange[]): string[] {
  const packages = new Set<string>();
  for (const change of changes) {
    if (change.path[0] === 'workspaces' && change.path.length >= 4) {
      // workspaces/<project>/<depType>/<packageName>/...
      packages.add(change.path[3]);
    } else if (change.path[0] === 'packages' && change.path.length >= 2) {
      // packages/<pkgKey>/... -- extract package name
      const pkgName = extractPackageNameFromBunKey(change.path[1]);
      if (pkgName) {
        packages.add(pkgName);
      }
    }
  }
  return Array.from(packages);
}

/**
 * Extract a package name from a bun packages key.
 * Keys look like: "lodash@4.17.21" or "@scope/pkg@1.0.0"
 */
function extractPackageNameFromBunKey(key: string): string | null {
  if (typeof key !== 'string') return null;
  if (key.startsWith('@')) {
    const secondAt = key.indexOf('@', 1);
    if (secondAt > 0) return key.substring(0, secondAt);
    return key;
  }
  const atIndex = key.indexOf('@');
  if (atIndex > 0) return key.substring(0, atIndex);
  return key;
}
