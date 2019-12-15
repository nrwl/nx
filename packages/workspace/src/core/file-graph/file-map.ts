import { FileData } from '../file-utils';

export interface FileMap {
  [projectName: string]: FileData[];
}

export function createFileMap(workspaceJson: any, files: FileData[]): FileMap {
  const graph: FileMap = {};
  const seen = new Set();
  // Sorting here so `apps/client-e2e` comes before `apps/client` and has
  // a chance to match prefix first.
  Object.keys(workspaceJson.projects)
    .sort((a, b) => {
      if (!workspaceJson.projects[a].root) return -1;
      if (!workspaceJson.projects[b].root) return -1;
      return workspaceJson.projects[a].root.length >
        workspaceJson.projects[b].root.length
        ? -1
        : 1;
    })
    .forEach(projectName => {
      const p = workspaceJson.projects[projectName];
      files.forEach(f => {
        if (seen.has(f.file)) {
          return;
        }
        if (f.file.startsWith(p.root)) {
          graph[projectName] = graph[projectName] || [];
          graph[projectName].push(f);
          seen.add(f.file);
        }
      });
    });
  return graph;
}
