import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  workspaceJson
): string[] => {
  // sort project names with the most nested first,
  // e.g. ['libs/a/b/c', 'libs/a/b', 'libs/a']
  const projectKeys = Object.keys(workspaceJson.projects).sort((a, b) =>
    b.localeCompare(a)
  );
  return touchedFiles
    .map(f => {
      return projectKeys.find(projectName => {
        const p = workspaceJson.projects[projectName];
        const projectRoot = p.root.endsWith('/') ? p.root : p.root + '/';
        return f.file.startsWith(projectRoot);
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
