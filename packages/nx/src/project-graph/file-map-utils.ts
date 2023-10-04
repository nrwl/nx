import {
  FileData,
  FileMap,
  ProjectFileMap,
  ProjectGraph,
} from '../config/project-graph';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from './utils/find-project-for-path';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { readProjectsConfigurationFromProjectGraph } from './project-graph';
import { getAllFileDataInContext } from '../utils/workspace-context';
import { workspaceRoot } from '../utils/workspace-root';

export async function createProjectFileMapUsingProjectGraph(
  graph: ProjectGraph
): Promise<ProjectFileMap> {
  const configs = readProjectsConfigurationFromProjectGraph(graph);

  let files;
  if (daemonClient.enabled()) {
    files = await daemonClient.getAllFileData();
  } else {
    files = getAllFileDataInContext(workspaceRoot);
  }

  return createFileMap(configs, files).fileMap.projectFileMap;
}

export function createFileMap(
  projectsConfigurations: ProjectsConfigurations,
  allWorkspaceFiles: FileData[]
): {
  allWorkspaceFiles: FileData[];
  fileMap: FileMap;
} {
  const projectFileMap: ProjectFileMap = {};
  const projectRootMappings =
    createProjectRootMappingsFromProjectConfigurations(
      projectsConfigurations.projects
    );
  const nonProjectFiles: FileData[] = [];

  for (const projectName of Object.keys(projectsConfigurations.projects)) {
    projectFileMap[projectName] ??= [];
  }
  for (const f of allWorkspaceFiles) {
    const projectFileMapKey = findProjectForPath(f.file, projectRootMappings);
    if (projectFileMapKey) {
      const matchingProjectFiles = projectFileMap[projectFileMapKey];
      if (matchingProjectFiles) {
        matchingProjectFiles.push(f);
      }
    } else {
      nonProjectFiles.push(f);
    }
  }
  return {
    allWorkspaceFiles,
    fileMap: {
      projectFileMap,
      nonProjectFiles,
    },
  };
}

export function updateFileMap(
  projectsConfigurations: Record<string, ProjectConfiguration>,
  { projectFileMap, nonProjectFiles }: FileMap,
  allWorkspaceFiles: FileData[],
  updatedFiles: Map<string, string>,
  deletedFiles: string[]
): { fileMap: FileMap; allWorkspaceFiles: FileData[] } {
  const projectRootMappings =
    createProjectRootMappingsFromProjectConfigurations(projectsConfigurations);
  let nonProjectFilesMap = new Map(nonProjectFiles.map((f) => [f.file, f]));

  for (const f of updatedFiles.keys()) {
    const project = findProjectForPath(f, projectRootMappings);
    if (project) {
      const matchingProjectFiles = projectFileMap[project] ?? [];
      if (matchingProjectFiles) {
        const fileData: FileData = matchingProjectFiles.find(
          (t) => t.file === f
        );
        if (fileData) {
          fileData.hash = updatedFiles.get(f);
        } else {
          matchingProjectFiles.push({
            file: f,
            hash: updatedFiles.get(f),
          });
        }
      }
    } else {
      const hash = updatedFiles.get(f);
      const entry = nonProjectFilesMap.get(f) ?? { file: f, hash };
      entry.hash = hash;
      nonProjectFilesMap.set(f, entry);
    }

    const fileData: FileData = allWorkspaceFiles.find((t) => t.file === f);
    if (fileData) {
      fileData.hash = updatedFiles.get(f);
    } else {
      allWorkspaceFiles.push({
        file: f,
        hash: updatedFiles.get(f),
      });
    }
  }

  for (const f of deletedFiles) {
    const matchingProjectFiles =
      projectFileMap[findProjectForPath(f, projectRootMappings)] ?? [];
    if (matchingProjectFiles) {
      const index = matchingProjectFiles.findIndex((t) => t.file === f);
      if (index > -1) {
        matchingProjectFiles.splice(index, 1);
      }
    }
    if (nonProjectFilesMap.has(f)) {
      nonProjectFilesMap.delete(f);
    }
    const index = allWorkspaceFiles.findIndex((t) => t.file === f);
    if (index > -1) {
      allWorkspaceFiles.splice(index, 1);
    }
  }
  return {
    fileMap: {
      projectFileMap,
      nonProjectFiles: Array.from(nonProjectFilesMap.values()),
    },
    allWorkspaceFiles,
  };
}
