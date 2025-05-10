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

export const PNPM_LOCK_FILES = ['pnpm-lock.yaml', 'pnpm-lock.yml'];

const ALL_LOCK_FILES = [
  ...PNPM_LOCK_FILES,
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
];

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
 * For pnpm projects, check lock file for changes to importers and return the project paths that have changes.
 */
const getProjectPathsAffectedByDependencyUpdates = (
  changedLockFile?: FileChange<WholeFileChange | JsonChange>
): string[] => {
  if (!changedLockFile) {
    return [];
  }
  const changedProjectPaths = new Set<string>();
  if (PNPM_LOCK_FILES.includes(changedLockFile.file)) {
    for (const change of changedLockFile.getChanges()) {
      if (
        isJsonChange(change) &&
        change.path[0] === 'importers' &&
        change.path[1] !== undefined
      ) {
        changedProjectPaths.add(change.path[1]);
      }
    }
  }
  return Array.from(changedProjectPaths);
};

const getProjectsNamesFromPaths = (
  projectGraphNodes: Record<string, ProjectGraphProjectNode>,
  projectPaths: string[]
): string[] => {
  const lookup = new RootPathLookup(projectGraphNodes);
  return projectPaths.map((path) => {
    return lookup.findNodeNameByRoot(path);
  });
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
