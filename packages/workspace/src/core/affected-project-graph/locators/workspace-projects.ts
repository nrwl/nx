import { NxJson } from '../../shared-interfaces';
import { FileChange } from '../../file-utils';

export function getTouchedProjects(
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

export function getImplicitlyTouchedProjects(
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
    } else if (Array.isArray(projects)) {
      touched.push(...projects);
    }
  }

  return touched;
}
