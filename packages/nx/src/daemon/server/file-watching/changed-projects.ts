import { performance } from 'perf_hooks';
import { projectFileMapWithFiles } from '../project-graph-incremental-recomputation';

export type ChangedFile = {
  path: string;
  type: 'create' | 'update' | 'delete';
};

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

  const fileToProjectMap: Record<string, string> = {};
  for (const [projectName, projectFiles] of Object.entries(
    projectFileMapWithFiles?.projectFileMap ?? {}
  )) {
    for (const projectFile of projectFiles) {
      fileToProjectMap[projectFile.file] = projectName;
    }
  }

  for (const changedFile of allChangedFiles) {
    const project = fileToProjectMap[changedFile.path];
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
