import * as minimatch from 'minimatch';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  projectGraphNodes
): string[] => {
  // sort project names with the most nested first,
  // e.g. ['libs/a/b/c', 'libs/a/b', 'libs/a']
  const projectNames = Object.entries(projectGraphNodes)
    .sort(([name1, p1]: any, [name2, p2]: any) =>
      p1.root.length > p2.root.length ? -1 : 1
    )
    .map(([name]) => name);

  return touchedFiles
    .map((f) => {
      return projectNames.find((projectName) => {
        const p = projectGraphNodes[projectName].data;
        const projectRoot = p.root.endsWith('/') ? p.root : `${p.root}/`;
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

  const touched = new Set<string>();

  for (const [pattern, projects] of Object.entries(
    nxJson.implicitDependencies
  )) {
    const implicitDependencyWasChanged = fileChanges.some((f) =>
      minimatch(f.file, pattern)
    );
    if (!implicitDependencyWasChanged) {
      continue;
    }

    // File change affects all projects, just return all projects.
    if (Array.isArray(projects)) {
      projects.forEach((project) => touched.add(project));
    }
  }

  return Array.from(touched);
};
