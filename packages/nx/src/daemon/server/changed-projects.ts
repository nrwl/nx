import { performance } from 'perf_hooks';
import { projectFileMapWithFiles } from './project-graph-incremental-recomputation';

export type ChangedFile = {
  path: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
};

export function getProjectsAndGlobalChanges(allChangedFiles: ChangedFile[]): {
  projects: { [changedProject: string]: ChangedFile[] };
  globalFiles: ChangedFile[];
} {
  performance.mark('changed-projects:start');

  const changes: {
    projects: { [changedProject: string]: ChangedFile[] };
    globalFiles: ChangedFile[];
  } = {
    projects: {},
    globalFiles: [],
  };

  const projectFileMap = projectFileMapWithFiles?.projectFileMap ?? {};

  for (const changedFile of allChangedFiles) {
    const projects = Object.keys(projectFileMap);
    let globalFile = false;
    for (const project of projects) {
      const hasFile =
        projectFileMap[project].filter((f) => f.file === changedFile.path)
          .length > 0;
      if (hasFile) {
        (changes.projects[project] ??= []).push(changedFile);
        globalFile = false;
        // break this loop because a file can only belong to 1 project
        break;
      } else {
        globalFile = true;
      }
    }
    if (globalFile) {
      changes.globalFiles.push(changedFile);
    }
  }

  performance.mark('changed-projects:end');
  performance.measure(
    'changed-projects',
    'changed-projects:start',
    'changed-projects:end'
  );

  return changes;
}
