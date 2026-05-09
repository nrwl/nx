import { performance } from 'perf_hooks';
import type { ProjectGraph } from '../../../config/project-graph';
import {
  createProjectRootMappings,
  findProjectForPath,
  ProjectRootMappings,
} from '../../../project-graph/utils/find-project-for-path';
import { currentProjectGraph } from '../project-graph-incremental-recomputation';

export type ChangedFile = {
  path: string;
  type: 'create' | 'update' | 'delete';
};

// Cache the root mapping across notifications. `currentProjectGraph` is
// replaced (new reference) on every recomputation, so reference-identity
// tells us when the cache is stale.
let cachedGraphRef: ProjectGraph | undefined;
let cachedProjectRootMappings: ProjectRootMappings = new Map();

export function getProjectsAndGlobalChanges(
  createdFiles: string[] | null,
  updatedFiles: string[] | null,
  deletedFiles: string[] | null
) {
  const projectAndGlobalChanges: {
    projects: { [changedProject: string]: ChangedFile[] };
    globalFiles: ChangedFile[];
  } = {
    projects: {},
    globalFiles: [],
  };

  performance.mark('changed-projects:start');

  const allChangedFiles: ChangedFile[] = [
    ...(createdFiles ?? []).map<ChangedFile>((c) => ({
      path: c,
      type: 'create',
    })),
    ...(updatedFiles ?? []).map<ChangedFile>((c) => ({
      path: c,
      type: 'update',
    })),
    ...(deletedFiles ?? []).map<ChangedFile>((c) => ({
      path: c,
      type: 'delete',
    })),
  ];

  // Map by project-root prefix rather than by known file membership. A newly
  // created file won't appear in the fileMap until the next recomputation, but
  // its path already tells us which project it belongs to.
  if (currentProjectGraph !== cachedGraphRef) {
    cachedGraphRef = currentProjectGraph;
    cachedProjectRootMappings = currentProjectGraph
      ? createProjectRootMappings(currentProjectGraph.nodes)
      : new Map();
  }

  for (const changedFile of allChangedFiles) {
    const project = findProjectForPath(
      changedFile.path,
      cachedProjectRootMappings
    );
    if (project) {
      (projectAndGlobalChanges.projects[project] ??= []).push(changedFile);
    } else {
      projectAndGlobalChanges.globalFiles.push(changedFile);
    }
  }

  performance.mark('changed-projects:end');
  performance.measure(
    'changed-projects',
    'changed-projects:start',
    'changed-projects:end'
  );

  return projectAndGlobalChanges;
}
