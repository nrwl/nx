import { join } from 'path';

import { WholeFileChange } from '../../file-utils';
import {
  DiffType,
  isJsonChange,
  JsonChange,
} from '../../../utilities/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { getSortedProjectNodes, ProjectGraphNode } from '../../project-graph';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';

export const getTouchedProjectsFromTsConfig: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, _a, _b, _c, graph): string[] => {
  const tsConfigJsonChanges = touchedFiles.find(
    (change) =>
      change.file === 'tsconfig.json' || change.file === 'tsconfig.base.json'
  );
  if (!tsConfigJsonChanges) {
    return [];
  }

  const sortedNodes = getSortedProjectNodes(graph.nodes);

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
    touched.push(...getProjectsAffectedByPaths(change, sortedNodes));
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
  sortedNodes: ProjectGraphNode[]
) {
  const result = [];

  const paths: string[] = [change.value.lhs, change.value.rhs];
  paths.forEach((path) => {
    sortedNodes.forEach((project) => {
      if (
        path &&
        project.data.root &&
        join(appRootPath, path).startsWith(join(appRootPath, project.data.root))
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
