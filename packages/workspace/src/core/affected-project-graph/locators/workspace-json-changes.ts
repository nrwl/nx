import {
  isWholeFileChange,
  WholeFileChange,
  workspaceFileName
} from '../../file-utils';
import { isJsonChange, JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedProjectsInWorkspaceJson: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, workspaceJson): string[] => {
  const workspaceChange = touchedFiles.find(
    change => change.file === workspaceFileName()
  );
  if (!workspaceChange) {
    return [];
  }

  const changes = workspaceChange.getChanges();

  if (
    changes.some(change => {
      if (isJsonChange(change)) {
        return change.path[0] !== 'projects';
      }
      if (isWholeFileChange(change)) {
        return true;
      }
      return false;
    })
  ) {
    return Object.keys(workspaceJson.projects);
  }

  const touched = [];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!isJsonChange(change) || change.path[0] !== 'projects') {
      return;
    }

    if (workspaceJson.projects[change.path[1]]) {
      touched.push(change.path[1]);
    } else {
      // The project was deleted so affect all projects
      touched.push(...Object.keys(workspaceJson.projects));
      // Break out of the loop after all projects have been added.
      break;
    }
  }
  return touched;
};
