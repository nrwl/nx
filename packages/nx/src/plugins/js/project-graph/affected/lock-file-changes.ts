import {
  DependencyChanges,
  TouchedProjectLocator,
} from '../../../../project-graph/affected/affected-project-graph-models';
import {
  FileChange,
  isLockFileChange,
  LockFileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import { join } from 'node:path';
import { jsPluginConfig as readJsPluginConfig } from '../../utils/config';
import { findMatchingProjects } from '../../../../utils/find-matching-projects';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { NxJsonConfiguration } from '../../../../config/nx-json';
import { hashArray } from '../../../../hasher/file-hasher';
import { fileExists, readJsonFile } from '../../../../utils/fileutils';
import { output } from '../../../../utils/output';
import { PackageJson } from '../../../../utils/package-json';
import { workspaceRoot } from '../../../../utils/workspace-root';
import {
  AUTO_AFFECTED_LOCK_FILES,
  getLockFileNodesForName,
} from '../../lock-file/lock-file';

const PACKAGE_JSON_DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

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
  const changedLockFile = findChangedLockFile(fileChanges);
  const allProjectNames = Object.values(projectGraphNodes).map((p) => p.name);

  if (projectsAffectedByDependencyUpdates === 'auto') {
    if (!changedLockFile) {
      return [];
    }
    // External nodes the reverse walk carries to dependents, plus projects
    // that still depend on a package only the base lockfile contains.
    // Null falls back to every project when the diff cannot be pinned.
    const pinned = changedExternalNodes(
      changedLockFile,
      projectGraph,
      packageJson
    );
    return pinned ? [...pinned.externals, ...pinned.projects] : allProjectNames;
  } else if (Array.isArray(projectsAffectedByDependencyUpdates)) {
    return findMatchingProjects(
      projectsAffectedByDependencyUpdates,
      projectGraphNodes
    );
  }

  return changedLockFile ? allProjectNames : [];
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
    changedExternalTypes: [],
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
      ),
    };
  }
  const pinned =
    projectsAffectedByDependencyUpdates === 'auto'
      ? changedExternalNodes(changedLockFile, projectGraph, packageJson)
      : null;
  return pinned
    ? { ...none, externals: pinned.externals, projects: pinned.projects }
    : { ...none, changedExternalTypes: ['npm'] };
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
 * External nodes whose package changed, and projects that depended on a
 * package present only in the base lockfile.
 *
 * Null when the diff cannot be pinned: a WholeFileChange (a revision could
 * not be read), a parse failure, or a package that changed in the head
 * lockfile but has no external node in the head graph. A package that exists
 * only in the base lockfile is a removal, not one of those misses.
 */
function changedExternalNodes(
  changedLockFile: FileChange<WholeFileChange | LockFileChange>,
  projectGraph: ProjectGraph,
  packageJson: PackageJson | undefined
): { externals: string[]; projects: string[] } | null {
  const changes = changedLockFile.getChanges();
  if (!changes.every(isLockFileChange)) {
    return null;
  }

  const diff = getChangedPackageNames(
    changedLockFile.file,
    changes,
    packageJson
  );
  if (diff === null) {
    return null;
  }
  if (diff.changed.size === 0 && diff.removed.size === 0) {
    return { externals: [], projects: [] };
  }

  const externalNodes = projectGraph.externalNodes ?? {};
  const { touchedNodeNames, missingPackageNames } =
    findExternalNodesByPackageName(diff.changed, externalNodes);
  if (missingPackageNames.size > 0) {
    return null;
  }

  const { touchedNodeNames: removedExternalNodes } =
    findExternalNodesByPackageName(diff.removed, externalNodes);

  return {
    externals: [...touchedNodeNames, ...removedExternalNodes],
    projects: projectsDependingOnRemovedPackages(
      diff.removed,
      diff.removedNodeNames,
      projectGraph,
      packageJson
    ),
  };
}

/**
 * Diff the parsed package fingerprints. `changed` is in the head with a
 * different fingerprint, including additions. `removed` is only in the base,
 * and `removedNodeNames` are that revision's external node names. Null when
 * parsing fails.
 */
function getChangedPackageNames(
  file: string,
  changes: LockFileChange[],
  packageJson: PackageJson | undefined
): {
  changed: Set<string>;
  removed: Set<string>;
  removedNodeNames: Set<string>;
} | null {
  try {
    const changed = new Set<string>();
    const removed = new Set<string>();
    const baseNodeSets: Record<string, ProjectGraphExternalNode>[] = [];
    // calculateFileChanges emits a single LockFileChange per lock file, but
    // the iteration keeps the contract open in case multiple ranges are ever
    // emitted for the same file.
    for (const change of changes) {
      const baseNodes = getLockFileNodesForName(
        file,
        change.baseContent,
        hashArray([change.baseContent]),
        packageJson
      ).nodes;
      const headFingerprints = collectPackageFingerprints(
        getLockFileNodesForName(
          file,
          change.headContent,
          hashArray([change.headContent]),
          packageJson
        ).nodes
      );
      baseNodeSets.push(baseNodes);
      const baseFingerprints = collectPackageFingerprints(baseNodes);

      for (const [name, fingerprints] of headFingerprints) {
        const baseSet = baseFingerprints.get(name);
        if (!baseSet || !setsEqual(baseSet, fingerprints)) {
          changed.add(name);
        }
      }
      for (const name of baseFingerprints.keys()) {
        if (!headFingerprints.has(name)) {
          removed.add(name);
        }
      }
    }

    // A package that one range removes and another changes is not gone.
    for (const name of changed) {
      removed.delete(name);
    }

    const removedNodeNames = new Set<string>();
    for (const nodes of baseNodeSets) {
      for (const node of Object.values(nodes ?? {})) {
        const packageName = node.data?.packageName;
        if (packageName && removed.has(packageName) && node.name) {
          removedNodeNames.add(node.name);
        }
      }
    }

    return { changed, removed, removedNodeNames };
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
 * Projects that still depend on a removed package. Match graph edges to the
 * base lockfile node name, and package.json manifests that still declare it.
 */
function projectsDependingOnRemovedPackages(
  removed: Set<string>,
  removedNodeNames: Set<string>,
  projectGraph: ProjectGraph,
  packageJson: PackageJson | undefined
): string[] {
  if (removed.size === 0) {
    return [];
  }

  const projects = new Set<string>();
  const nodes = projectGraph.nodes ?? {};

  for (const [source, deps] of Object.entries(
    projectGraph.dependencies ?? {}
  )) {
    if (!nodes[source] || !deps?.length) continue;
    if (
      deps.some((dep) =>
        dependencyTargetsRemovedPackage(dep.target, removed, removedNodeNames)
      )
    ) {
      projects.add(source);
    }
  }

  for (const project of Object.values(nodes)) {
    if (projects.has(project.name)) continue;
    const root = project.data?.root;
    const isWorkspaceRoot = root === '.' || root === '';
    const manifest = isWorkspaceRoot
      ? (packageJson ?? readProjectManifest(root))
      : readProjectManifest(root);
    if (manifestDeclaresRemovedPackage(manifest, removed)) {
      projects.add(project.name);
    }
  }

  return [...projects];
}

function dependencyTargetsRemovedPackage(
  target: string,
  removed: Set<string>,
  removedNodeNames: Set<string>
): boolean {
  if (removedNodeNames.has(target)) return true;
  if (!target.startsWith('npm:')) return false;
  const spec = target.slice('npm:'.length);
  if (removed.has(spec)) return true;
  // `npm:@scope/name@version` — the version separator is the last `@`.
  const at = spec.lastIndexOf('@');
  return at > 0 && removed.has(spec.slice(0, at));
}

function readProjectManifest(
  projectRoot: string | undefined
): PackageJson | undefined {
  if (projectRoot == null) return undefined;
  const manifestPath = join(workspaceRoot, projectRoot, 'package.json');
  if (!fileExists(manifestPath)) return undefined;
  try {
    return readJsonFile<PackageJson>(manifestPath);
  } catch {
    return undefined;
  }
}

function manifestDeclaresRemovedPackage(
  manifest: PackageJson | undefined,
  removed: Set<string>
): boolean {
  if (!manifest) return false;
  for (const section of PACKAGE_JSON_DEPENDENCY_SECTIONS) {
    const deps = manifest[section];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (removed.has(name)) return true;
    }
  }
  return false;
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
