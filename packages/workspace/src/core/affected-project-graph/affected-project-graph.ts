import { ProjectGraph } from '../project-graph';
import { FileChange, readNxJson, readWorkspaceJson } from '../file-utils';
import { filterAffectedProjects } from './filter-affected-projects';
import { NxJson } from '../shared-interfaces';

export function filterAffected(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  workspaceJson: any = readWorkspaceJson(),
  nxJson: NxJson = readNxJson()
): ProjectGraph {
  // Additional affected logic should be in this array.
  const touchedProjectLocators = [
    getTouchedProjects,
    getImplicitlyTouchedProjects
  ];
  const touchedProjects = touchedProjectLocators.reduce(
    (acc, f) => {
      return acc.concat(f(workspaceJson, nxJson, touchedFiles));
    },
    [] as string[]
  );
  return filterAffectedProjects(graph, {
    workspaceJson,
    nxJson,
    touchedProjects
  });
}

// ---------------------------------------------------------------------------

function getTouchedProjects(
  workspaceJson: any,
  nxJson: NxJson,
  touchedFiles: FileChange[]
): string[] {
  return touchedFiles
    .map(f => {
      return Object.keys(workspaceJson.projects).find(projectName => {
        const p = workspaceJson.projects[projectName];
        return f.file.startsWith(p.root);
      });
    })
    .filter(Boolean);
}

function getImplicitlyTouchedProjects(
  workspaceJson: any,
  nxJson: NxJson,
  fileChanges: FileChange[]
): string[] {
  if (!nxJson.implicitDependencies) {
    return [];
  }

  const touched = [];

  for (const [filePath, projects] of Object.entries(
    nxJson.implicitDependencies
  )) {
    const implicitDependencyWasChanged = fileChanges.some(
      f => f.file === filePath
    );
    if (!implicitDependencyWasChanged) {
      continue;
    }

    // File change affects all projects, just return all projects.
    if (projects === '*') {
      return Object.keys(workspaceJson.projects);
    } else {
      touched.push(...projects);
    }
  }

  return touched;
}
