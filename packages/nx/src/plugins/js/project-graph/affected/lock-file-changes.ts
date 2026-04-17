import { readNxJson } from '../../../../config/configuration';
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
import { getNpmLockfileNodes } from '../../lock-file/npm-parser';
import { getPnpmLockfileNodes } from '../../lock-file/pnpm-parser';
import { getYarnLockfileNodes } from '../../lock-file/yarn-parser';
import { getBunTextLockfileNodes } from '../../lock-file/bun-parser';

type LockFileNodeParser = (
  contents: string,
  hash: string,
  packageJson: any
) => Record<string, ProjectGraphExternalNode>;

const LOCK_FILE_PARSERS: Record<string, LockFileNodeParser> = {
  'pnpm-lock.yaml': (contents, hash) =>
    getPnpmLockfileNodes(contents, hash).nodes,
  'pnpm-lock.yml': (contents, hash) =>
    getPnpmLockfileNodes(contents, hash).nodes,
  'package-lock.json': (contents, hash) =>
    getNpmLockfileNodes(contents, hash).nodes,
  'yarn.lock': (contents, hash, packageJson) =>
    getYarnLockfileNodes(contents, hash, packageJson ?? {}).nodes,
  'bun.lock': (contents, hash) => getBunTextLockfileNodes(contents, hash),
};

const SUPPORTED_LOCK_FILES = Object.keys(LOCK_FILE_PARSERS);

// bun.lockb is a binary file, so auto mode always falls back to "all
// projects affected" via WholeFileChange. We still need to recognize
// it when deciding whether a file change is a lock file change.
const ALL_LOCK_FILES = [...SUPPORTED_LOCK_FILES, 'bun.lockb'];

export const getTouchedProjectsFromLockFile: TouchedProjectLocator<
  WholeFileChange | LockFileChange
> = (
  fileChanges,
  projectGraphNodes,
  _nxJson,
  packageJson,
  projectGraph
): string[] => {
  const nxJson = readNxJson();
  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);

  const changedLockFile = fileChanges.find((f) =>
    ALL_LOCK_FILES.includes(f.file)
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
  packageJson: any
): string[] {
  const allProjectNames = Object.values(projectGraphNodes).map((p) => p.name);

  if (!changedLockFile) {
    return [];
  }

  if (!SUPPORTED_LOCK_FILES.includes(changedLockFile.file)) {
    // Binary formats (bun.lockb) and unrecognized files cannot be
    // parsed for package-level changes. Fall back to all projects.
    output.warn({
      title: `Unable to determine granular changes for "${changedLockFile.file}". All projects will be marked as affected.`,
    });
    return allProjectNames;
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
  const externalNodes = projectGraph?.externalNodes ?? {};
  const touchedNodeNames = findExternalNodesByPackageName(
    changedPackageNames,
    externalNodes
  );

  if (touchedNodeNames.length > 0) {
    return touchedNodeNames;
  }

  // Changed packages weren't found in external nodes -- they may have
  // been removed or the graph may not include them. Fall back to
  // marking all projects as affected.
  return allProjectNames;
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
  packageJson: any
): Set<string> | null {
  const parser = LOCK_FILE_PARSERS[file];
  if (!parser) return null;

  try {
    const changed = new Set<string>();
    for (const change of changes) {
      const baseVersions = collectPackageVersions(
        parser(change.baseContent, hashArray([change.baseContent]), packageJson)
      );
      const headVersions = collectPackageVersions(
        parser(change.headContent, hashArray([change.headContent]), packageJson)
      );

      for (const [name, versions] of headVersions) {
        const baseSet = baseVersions.get(name);
        if (!baseSet || !setsEqual(baseSet, versions)) {
          changed.add(name);
        }
      }
      for (const name of baseVersions.keys()) {
        if (!headVersions.has(name)) {
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
 * external-node record returned by a lock-file parser. Multiple
 * versions of the same package may be installed as transitive deps,
 * so we track all of them.
 */
function collectPackageVersions(
  nodes: Record<string, ProjectGraphExternalNode>
): Map<string, Set<string>> {
  const versions = new Map<string, Set<string>>();
  for (const node of Object.values(nodes ?? {})) {
    const name = node.data?.packageName;
    if (!name) continue;
    const version = node.data.version ?? '';
    let set = versions.get(name);
    if (!set) {
      set = new Set<string>();
      versions.set(name, set);
    }
    set.add(version);
  }
  return versions;
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
): string[] {
  const nodeNames: string[] = [];
  for (const [name, node] of Object.entries(externalNodes)) {
    if (packageNames.has(node.data.packageName)) {
      nodeNames.push(name);
    }
  }
  return nodeNames;
}
