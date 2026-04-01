import { readNxJson } from '../../../../config/configuration';
import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import {
  FileChange,
  WholeFileChange,
} from '../../../../project-graph/file-utils';
import { isJsonChange, JsonChange } from '../../../../utils/json-diff';
import { jsPluginConfig as readJsPluginConfig } from '../../utils/config';
import { findMatchingProjects } from '../../../../utils/find-matching-projects';
import { ProjectGraphProjectNode } from '../../../../config/project-graph';

type AffectedPathsResolver = (changes: JsonChange[]) => string[] | null;

/**
 * Maps every supported lock file to a function that extracts affected
 * project paths from its JSON-level changes. Adding a new lock file
 * here automatically includes it in detection -- no separate list to
 * keep in sync.
 */
const LOCK_FILE_RESOLVERS = {
  'pnpm-lock.yaml': getAffectedPathsFromPnpmLock,
  'pnpm-lock.yml': getAffectedPathsFromPnpmLock,
  'package-lock.json': getAffectedPathsFromNpmLock,
  'yarn.lock': getAffectedPathsFromYarnLock,
  'bun.lockb': getAffectedPathsFromBunLock,
  'bun.lock': getAffectedPathsFromBunLock,
} satisfies Record<string, AffectedPathsResolver>;

type SupportedLockFile = keyof typeof LOCK_FILE_RESOLVERS;

function isSupportedLockFile(file: string): file is SupportedLockFile {
  return file in LOCK_FILE_RESOLVERS;
}

const ALL_LOCK_FILES = Object.keys(LOCK_FILE_RESOLVERS);

export const getTouchedProjectsFromLockFile: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (fileChanges, projectGraphNodes): string[] => {
  const nxJson = readNxJson();
  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);

  const changedLockFile = fileChanges.find((f) =>
    ALL_LOCK_FILES.includes(f.file)
  );

  if (projectsAffectedByDependencyUpdates === 'auto') {
    const changedProjectPaths =
      getProjectPathsAffectedByDependencyUpdates(changedLockFile);
    if (changedProjectPaths === null) {
      return Object.values(projectGraphNodes).map((p) => p.name);
    }
    const changedProjectNames = getProjectsNamesFromPaths(
      projectGraphNodes,
      changedProjectPaths
    );
    return changedProjectNames;
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
 * pnpm-lock.yaml structure:
 *   importers:
 *     <project-path>:
 *       dependencies: ...
 */
function getAffectedPathsFromPnpmLock(changes: JsonChange[]): string[] {
  const paths = new Set<string>();
  for (const change of changes) {
    if (change.path[0] === 'importers' && change.path[1] !== undefined) {
      paths.add(change.path[1]);
    }
  }
  return Array.from(paths);
}

/**
 * package-lock.json (v2/v3) structure:
 *   packages:
 *     <project-path>/node_modules/<pkg>:
 *       version: ...
 */
function getAffectedPathsFromNpmLock(changes: JsonChange[]): string[] {
  const paths = new Set<string>();
  for (const change of changes) {
    if (change.path[0] === 'packages' && typeof change.path[1] === 'string') {
      const nodeModulesIndex = change.path[1].indexOf('/node_modules/');
      if (nodeModulesIndex > 0) {
        paths.add(change.path[1].substring(0, nodeModulesIndex));
      }
    }
  }
  return Array.from(paths);
}

/**
 * yarn.lock is a flat map of "package@range" -> metadata with no
 * per-project structure, so we cannot narrow to specific projects.
 */
function getAffectedPathsFromYarnLock(): null {
  return null;
}

/**
 * bun.lock structure:
 *   workspaces:
 *     <project-path>:
 *       dependencies: ...
 */
function getAffectedPathsFromBunLock(changes: JsonChange[]): string[] {
  const paths = new Set<string>();
  for (const change of changes) {
    if (change.path[0] === 'workspaces' && change.path[1] !== undefined) {
      paths.add(change.path[1]);
    }
  }
  return Array.from(paths);
}

/**
 * Check lock file for changes and return the project paths that have changes.
 *
 * Returns null when affected projects cannot be determined (meaning all
 * projects should be considered affected).
 */
const getProjectPathsAffectedByDependencyUpdates = (
  changedLockFile?: FileChange<WholeFileChange | JsonChange>
): string[] | null => {
  if (!changedLockFile) {
    return [];
  }

  const changes = changedLockFile.getChanges();

  // If any change is a WholeFileChange we cannot determine which
  // specific projects are affected, so signal "all projects".
  if (changes.some((c) => !isJsonChange(c))) {
    return null;
  }

  if (!isSupportedLockFile(changedLockFile.file)) {
    // TODO: should we log a warning here?
    return null;
  }

  return LOCK_FILE_RESOLVERS[changedLockFile.file](
    changes.filter(isJsonChange)
  );
};

const getProjectsNamesFromPaths = (
  projectGraphNodes: Record<string, ProjectGraphProjectNode>,
  projectPaths: string[]
): string[] => {
  if (!projectPaths.length) {
    return [];
  }
  const lookup = new RootPathLookup(projectGraphNodes);
  return projectPaths
    .map((path) => lookup.findNodeNameByRoot(path))
    .filter(Boolean);
};

class RootPathLookup {
  private rootToNameMap: Map<string, string>;

  constructor(nodes: Record<string, ProjectGraphProjectNode>) {
    this.rootToNameMap = new Map();
    Object.entries(nodes).forEach(([name, node]) => {
      this.rootToNameMap.set(node.data.root, name);
    });
  }

  findNodeNameByRoot(root: string): string | undefined {
    return this.rootToNameMap.get(root);
  }
}
