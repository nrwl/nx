import { FileData, ProjectFileMap } from '../../config/project-graph';
import { performance } from 'perf_hooks';

export function buildAllWorkspaceFiles(
  projectFileMap: ProjectFileMap,
  globalFiles: FileData[]
): FileData[] {
  performance.mark('get-all-workspace-files:start');
  let fileData: FileData[] = Object.values(projectFileMap).flat();
  fileData = fileData
    .concat(globalFiles)
    .sort((a, b) => a.file.localeCompare(b.file));
  performance.mark('get-all-workspace-files:end');
  performance.measure(
    'get-all-workspace-files',
    'get-all-workspace-files:start',
    'get-all-workspace-files:end'
  );

  return fileData;
}
