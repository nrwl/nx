import { WholeFileChange } from '../../file-utils';
import {
  JsonDiffType,
  isJsonChange,
  JsonChange,
} from '../../../utils/json-diff';
import { getRootTsConfigFileName } from '../../../utils/typescript';
import {
  LocatorResult,
  TouchedProjectLocator,
} from '../affected-project-graph-models';
import { ProjectGraphProjectNode } from '../../../config/project-graph';

export const getTouchedProjectsFromTsConfig: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, _a, _b, _c, graph) => {
  const rootTsConfig = getRootTsConfigFileName();
  if (!rootTsConfig) {
    return new Map();
  }
  const tsConfigJsonChanges = touchedFiles.find(
    (change) => change.file === rootTsConfig
  );
  if (!tsConfigJsonChanges) {
    return new Map();
  }

  const changes = tsConfigJsonChanges.getChanges();

  if (!allChangesArePathChanges(changes)) {
    return new Map(
      Object.keys(graph.nodes).map((p) => [
        p,
        `A non-path change was made to the root ${rootTsConfig}`,
      ])
    );
  }

  const touched: LocatorResult = new Map();
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];

    if (change.path.length !== 4) {
      continue;
    }

    // If a path is deleted, everything is touched
    if (change.type === JsonDiffType.Deleted) {
      return new Map(
        Object.keys(graph.nodes).map((p) => [
          p,
          `A path was deleted from the root ${rootTsConfig}. This can affect any project.`,
        ])
      );
    }
    const projects = getProjectsAffectedByPaths(
      change,
      Object.values(graph.nodes)
    );
    for (const project of projects) {
      const msg = `Project's path configuration was changed in ${rootTsConfig}`;
      const existing = touched.get(project);
      if (!existing) {
        touched.set(project, [msg]);
      } else {
        existing.push(msg);
      }
    }
  }
  return touched;
};

function allChangesArePathChanges(
  changes: Array<WholeFileChange | JsonChange>
): changes is JsonChange[] {
  return changes.every(isChangeToPathMappings);
}

/**
 * Gets both previous project and current project of a particular change to tsconfig paths
 */
function getProjectsAffectedByPaths(
  change: JsonChange,
  nodes: ProjectGraphProjectNode[]
) {
  const result = new Set<string>();
  const paths: string[] = [change.value.lhs, change.value.rhs];
  paths.forEach((path) => {
    nodes.forEach((project) => {
      const normalizedPath =
        path && path.startsWith('./') ? path.substring(2) : path;
      const r = project.data.root;
      const root = r && r.endsWith('/') ? r.substring(0, r.length - 1) : r;
      if (
        (normalizedPath && root && normalizedPath.startsWith(root)) ||
        normalizedPath == root
      ) {
        result.add(project.name);
      }
    });
  });

  return result;
}

/**
 * Change is possibly a change to path mappings
 */
function isChangeToPathMappings(
  change: WholeFileChange | JsonChange
): change is JsonChange {
  return (
    isJsonChange(change) &&
    change.path[0] === 'compilerOptions' &&
    (!change.path[1] || change.path[1] === 'paths')
  );
}
