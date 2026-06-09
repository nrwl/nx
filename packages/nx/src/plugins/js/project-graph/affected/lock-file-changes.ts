import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import {
  FileChange,
  isLockFileChange,
  LockFileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import { jsPluginConfig as readJsPluginConfig } from '../../utils/config';
import { findMatchingProjects } from '../../../../utils/find-matching-projects';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { hashArray } from '../../../../hasher/file-hasher';
import { output } from '../../../../utils/output';
import { PackageJson } from '../../../../utils/package-json';
import {
  AUTO_AFFECTED_LOCK_FILES,
  getLockFileNodesForName,
} from '../../lock-file/lock-file';

export const getTouchedProjectsFromLockFile: TouchedProjectLocator<
  WholeFileChange | LockFileChange
> = (
  fileChanges,
  projectGraphNodes,
  nxJson,
  packageJson,
  projectGraph
): string[] => {
  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);

  const changedLockFile = fileChanges.find((f) =>
    AUTO_AFFECTED_LOCK_FILES.includes(
      f.file as (typeof AUTO_AFFECTED_LOCK_FILES)[number]
    )
  );

  if (projectsAffectedByDependencyUpdates === 'auto') {
    return getAutoAffected(
      changedLockFile,
      projectGraphNodes,
      projectGraph,
      packageJson
    );
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
 * In auto mode, parse the lock file at the base and head revisions
 * using Nx's existing lock file parsers, then diff the resulting
 * external-node maps to determine which packages actually changed.
 *
 * Returns external node names (e.g. "npm:lodash@4.17.21") so the
 * graph reversal in filterAffected can walk back to workspace projects.
 */
function getAutoAffected(
  changedLockFile: FileChange<WholeFileChange | LockFileChange> | undefined,
  projectGraphNodes: Record<string, ProjectGraphProjectNode>,
  projectGraph: ProjectGraph,
  packageJson: PackageJson | undefined
): string[] {
  const allProjectNames = Object.values(projectGraphNodes).map((p) => p.name);

  if (!changedLockFile) {
    return [];
  }

  const changes = changedLockFile.getChanges();

  // A WholeFileChange means we were unable to read both revisions of
  // the lock file (e.g. missing base revision, git error). Fall back
  // to marking all projects affected.
  if (!changes.every(isLockFileChange)) {
    return allProjectNames;
  }

  const changedPackageNames = getChangedPackageNames(
    changedLockFile.file,
    changes,
    packageJson
  );

  if (changedPackageNames === null) {
    return allProjectNames;
  }

  if (changedPackageNames.size === 0) {
    return [];
  }

  // Look up the changed packages in the project graph's external nodes
  // and return the external node names. The graph reversal in
  // filterAffected walks from these nodes to workspace projects.
  const { touchedNodeNames, missingPackageNames } =
    findExternalNodesByPackageName(
      changedPackageNames,
      projectGraph.externalNodes ?? {}
    );

  if (missingPackageNames.size > 0) {
    return allProjectNames;
  }

  return touchedNodeNames;
}

/**
 * Parse the base and head revisions of the lock file with Nx's
 * existing parsers and diff the resulting package -> version maps.
 *
 * Returns the set of changed package names, or null if parsing
 * failed (in which case the caller should fall back to all projects).
 */
function getChangedPackageNames(
  file: string,
  changes: LockFileChange[],
  packageJson: PackageJson | undefined
): Set<string> | null {
  try {
    const changed = new Set<string>();
    // calculateFileChanges emits a single LockFileChange per lock file, but
    // the iteration keeps the contract open in case multiple ranges are ever
    // emitted for the same file.
    for (const change of changes) {
      const baseFingerprints = collectPackageFingerprints(
        getLockFileNodesForName(
          file,
          change.baseContent,
          hashArray([change.baseContent]),
          packageJson
        ).nodes
      );
      const headFingerprints = collectPackageFingerprints(
        getLockFileNodesForName(
          file,
          change.headContent,
          hashArray([change.headContent]),
          packageJson
        ).nodes
      );

      for (const [name, fingerprints] of headFingerprints) {
        const baseSet = baseFingerprints.get(name);
        if (!baseSet || !setsEqual(baseSet, fingerprints)) {
          changed.add(name);
        }
      }
      for (const name of baseFingerprints.keys()) {
        if (!headFingerprints.has(name)) {
          changed.add(name);
        }
      }
    }
    return changed;
  } catch (e) {
    output.warn({
      title: `Failed to parse "${file}" for projectsAffectedByDependencyUpdates "auto" mode. All projects will be marked as affected.`,
      bodyLines: [e instanceof Error ? e.message : String(e)],
    });
    return null;
  }
}

/**
 * Build a map of packageName -> set of versions present in the
 * external-node record returned by a lock-file parser. We include both
 * version and hash so patched/tarball/integrity-only changes still
 * count as lockfile changes even when the semver stays the same.
 */
function collectPackageFingerprints(
  nodes: Record<string, ProjectGraphExternalNode>
): Map<string, Set<string>> {
  const fingerprints = new Map<string, Set<string>>();
  for (const node of Object.values(nodes ?? {})) {
    const name = node.data?.packageName;
    if (!name) continue;
    const fingerprint = JSON.stringify({
      version: node.data.version ?? '',
      hash: node.data.hash ?? '',
    });
    let set = fingerprints.get(name);
    if (!set) {
      set = new Set<string>();
      fingerprints.set(name, set);
    }
    set.add(fingerprint);
  }
  return fingerprints;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/**
 * Given a set of package names, find all matching external node names
 * in the project graph.
 */
function findExternalNodesByPackageName(
  packageNames: Set<string>,
  externalNodes: Record<string, ProjectGraphExternalNode>
): { touchedNodeNames: string[]; missingPackageNames: Set<string> } {
  const touchedNodeNames: string[] = [];
  const matchedPackageNames = new Set<string>();
  for (const [name, node] of Object.entries(externalNodes)) {
    if (packageNames.has(node.data.packageName)) {
      touchedNodeNames.push(name);
      matchedPackageNames.add(node.data.packageName);
    }
  }
  return {
    touchedNodeNames,
    missingPackageNames: new Set(
      Array.from(packageNames).filter((name) => !matchedPackageNames.has(name))
    ),
  };
}
