import { WholeFileChange } from '../../file-utils';
import {
  DiffType,
  isJsonChange,
  JsonChange,
} from '../../../utilities/json-diff';
import { getRootTsConfigFileName } from '../../../utilities/typescript';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { ProjectGraphProjectNode } from '../../project-graph';

export const getTouchedProjectsFromTsConfig: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, _a, _b, _c, graph): string[] => {
  const rootTsConfig = getRootTsConfigFileName();
  if (!rootTsConfig) {
    return [];
  }
  const tsConfigJsonChanges = touchedFiles.find(
    (change) => change.file === rootTsConfig
  );
  if (!tsConfigJsonChanges) {
    return [];
  }

  const changes = tsConfigJsonChanges.getChanges();

  if (!allChangesArePathChanges(changes)) {
    return Object.keys(graph.nodes);
  }

  const touched: string[] = [];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];

    if (change.path.length !== 4) {
      continue;
    }

    // If a path is deleted, everything is touched
    if (change.type === DiffType.Deleted) {
      return Object.keys(graph.nodes);
    }
    touched.push(
      ...getProjectsAffectedByPaths(change, Object.values(graph.nodes))
    );
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
  const result = [];
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
        result.push(project.name);
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
