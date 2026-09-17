import {
  DependencyChanges,
  TouchedProjectLocator,
} from '../../../../project-graph/affected/affected-project-graph-models';
import type { TouchedProject } from '../../../../project-graph/affected/affected-reasons';
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
import { NxJsonConfiguration } from '../../../../config/nx-json';
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
): TouchedProject[] => {
  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);
  const changedLockFile = findChangedLockFile(fileChanges);
  const allProjects = Object.values(projectGraphNodes).map((p) => p.name);
  const fromLockFile = (projects: string[]): TouchedProject[] =>
    projects.map((project) => ({
      project,
      kind: 'lockfile' as const,
      file: changedLockFile?.file,
    }));

  if (projectsAffectedByDependencyUpdates === 'auto') {
    if (!changedLockFile) {
      return [];
    }
    // External node names, which the reverse walk in filterAffected carries
    // back to the projects depending on them, so the name is the package.
    const externals = changedExternalNodes(
      changedLockFile,
      projectGraph,
      packageJson
    );
    return externals
      ? externals.map((name) => ({
          project: name,
          kind: 'npm-package' as const,
          package: name,
          file: changedLockFile.file,
        }))
      : fromLockFile(allProjects);
  } else if (Array.isArray(projectsAffectedByDependencyUpdates)) {
    return fromLockFile(
      findMatchingProjects(
        projectsAffectedByDependencyUpdates,
        projectGraphNodes
      )
    );
  }

  return changedLockFile ? fromLockFile(allProjects) : [];
};

/**
 * The same change as task selection consumes it: the packages that moved,
 * which a plan names as `External`, rather than the projects depending on them.
 */
export function lockFileDependencyChanges(
  fileChanges: FileChange<WholeFileChange | LockFileChange>[],
  projectGraphNodes: Record<string, ProjectGraphProjectNode>,
  nxJson: NxJsonConfiguration,
  packageJson: PackageJson | undefined,
  projectGraph: ProjectGraph
): DependencyChanges {
  const none: DependencyChanges = {
    externals: [],
    allExternals: false,
    projects: [],
  };
  const changedLockFile = findChangedLockFile(fileChanges);
  if (!changedLockFile) {
    return none;
  }

  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);
  if (Array.isArray(projectsAffectedByDependencyUpdates)) {
    return {
      ...none,
      projects: findMatchingProjects(
        projectsAffectedByDependencyUpdates,
        projectGraphNodes
      ).map((project) => ({
        project,
        kind: 'lockfile' as const,
        file: changedLockFile.file,
      })),
    };
  }
  const externals =
    projectsAffectedByDependencyUpdates === 'auto'
      ? changedExternalNodes(changedLockFile, projectGraph, packageJson)
      : null;
  return externals ? { ...none, externals } : { ...none, allExternals: true };
}

function findChangedLockFile(
  fileChanges: FileChange<WholeFileChange | LockFileChange>[]
): FileChange<WholeFileChange | LockFileChange> | undefined {
  return fileChanges.find((f) =>
    AUTO_AFFECTED_LOCK_FILES.includes(
      f.file as (typeof AUTO_AFFECTED_LOCK_FILES)[number]
    )
  );
}

/**
 * Diffs the lock file's base and head revisions with the parsers the project
 * graph is built from, and names the external nodes whose package changed.
 *
 * Null when the diff cannot be pinned to packages: a WholeFileChange (a
 * revision could not be read), a parse failure, or a changed package with no
 * external node in the head graph.
 */
function changedExternalNodes(
  changedLockFile: FileChange<WholeFileChange | LockFileChange>,
  projectGraph: ProjectGraph,
  packageJson: PackageJson | undefined
): string[] | null {
  const changes = changedLockFile.getChanges();
  if (!changes.every(isLockFileChange)) {
    return null;
  }

  const changedPackageNames = getChangedPackageNames(
    changedLockFile.file,
    changes,
    packageJson
  );
  if (changedPackageNames === null) {
    return null;
  }
  if (changedPackageNames.size === 0) {
    return [];
  }

  const { touchedNodeNames, missingPackageNames } =
    findExternalNodesByPackageName(
      changedPackageNames,
      projectGraph.externalNodes ?? {}
    );
  return missingPackageNames.size > 0 ? null : touchedNodeNames;
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
