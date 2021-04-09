import * as minimatch from 'minimatch';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  _workspaceJson,
  _nxJson,
  _packageJson,
  graph
): string[] => {
  /**
   * We use the graph as the source of truth because non-JS languages may have added
   * to the project graph via a plugin, and there will not be a corresponding entry
   * in the workspace.json.
   *
   * Sort project names with the most nested first,
   * e.g. ['libs/a/b/c', 'libs/a/b', 'libs/a']
   */
  const projectNames = Object.values(graph.nodes)
    .filter((p) => p.type !== 'npm')
    .sort((p1, p2) => (p1.data.root.length > p2.data.root.length ? -1 : 1))
    .map((p) => p.name);

  return touchedFiles
    .map((f) => {
      return projectNames.find((projectName) => {
        const p = graph.nodes[projectName];
        const projectRoot = p.data.root.endsWith('/')
          ? p.data.root
          : `${p.data.root}/`;
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
