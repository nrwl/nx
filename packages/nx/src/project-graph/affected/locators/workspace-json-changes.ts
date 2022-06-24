import {
  isWholeFileChange,
  WholeFileChange,
  workspaceFileName,
} from '../../file-utils';
import { DiffType, isJsonChange, JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedProjectsInWorkspaceJson: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, projectGraphNodes): string[] => {
  const workspaceChange = touchedFiles.find(
    (change) => change.file === workspaceFileName()
  );
  if (!workspaceChange) {
    return [];
  }

  const changes = workspaceChange.getChanges();

  if (
    changes.some((change) => {
      if (isJsonChange(change)) {
        return change.path[0] !== 'projects';
      }
      if (isWholeFileChange(change)) {
        return true;
      }
      return false;
    })
  ) {
    return Object.keys(projectGraphNodes);
  }

  const touched = [];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!isJsonChange(change) || change.path[0] !== 'projects') {
      continue;
    }

    // Only look for changes that are changes to the whole project definition
    if (change.path.length !== 2) {
      continue;
    }

    switch (change.type) {
      case DiffType.Deleted: {
        // We are not sure which projects used to depend on a deleted project
        // so return all projects to be safe
        return Object.keys(projectGraphNodes);
      }
      default: {
        // Add the project name
        touched.push(change.path[1]);
      }
    }
  }
  return touched;
};
