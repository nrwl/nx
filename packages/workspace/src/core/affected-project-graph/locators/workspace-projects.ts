import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  workspaceJson
): string[] => {
  return touchedFiles
    .map(f => {
      return Object.keys(workspaceJson.projects).find(projectName => {
        const p = workspaceJson.projects[projectName];
        return f.file.startsWith(p.root);
      });
    })
    .filter(Boolean);
};

export const getImplicitlyTouchedProjects: TouchedProjectLocator = (
  fileChanges,
  workspaceJson,
  nxJson
): string[] => {
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
    if (Array.isArray(projects)) {
      touched.push(...projects);
    }
  }

  return touched;
};
