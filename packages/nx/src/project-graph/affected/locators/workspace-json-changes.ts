import { isWholeFileChange, WholeFileChange } from '../../file-utils';
import {
  JsonDiffType,
  isJsonChange,
  JsonChange,
} from '../../../utils/json-diff';
import {
  LocatorResult,
  TouchedProjectLocator,
} from '../affected-project-graph-models';

export const getTouchedProjectsInWorkspaceJson: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, projectGraphNodes): LocatorResult => {
  const workspaceChange = touchedFiles.find(
    (change) => change.file === `angular.json`
  );
  if (!workspaceChange) {
    return new Map();
  }

  const changes = workspaceChange.getChanges();

  const touched: LocatorResult = new Map();

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (isJsonChange(change)) {
      if (change.path[0] !== 'projects') {
        return new Map(
          Object.keys(projectGraphNodes).map((p) => [
            p,
            [
              'Non project related property in workspace.json changed: ' +
                change.path[0],
            ],
          ])
        );
      }
      if (change.path.length !== 2) {
        continue;
      }
      switch (change.type) {
        case JsonDiffType.Deleted: {
          // We are not sure which projects used to depend on a deleted project
          // so return all projects to be safe
          return new Map(
            Object.keys(projectGraphNodes).map((p) => [
              p,
              ['A project was deleted, which affects all projects'],
            ])
          );
        }
        default: {
          // Add the project name
          const projectName = change.path[1];
          touched.set(projectName, [
            `${projectName}'s configuration was changed`,
          ]);
        }
      }
    }
    if (isWholeFileChange(change)) {
      return new Map(
        Object.keys(projectGraphNodes).map((p) => [
          p,
          ['Workspace.json changed - whole file marked changed'],
        ])
      );
    }

    // Only look for changes that are changes to the whole project definition
  }

  return touched;
};
