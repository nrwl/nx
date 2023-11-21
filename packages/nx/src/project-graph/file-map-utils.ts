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
import {
  getAllFileDataInContext,
  updateProjectFiles,
} from '../utils/workspace-context';
import { workspaceRoot } from '../utils/workspace-root';
import { ExternalObject, NxWorkspaceFilesExternals } from '../native';
import { buildAllWorkspaceFiles } from './utils/build-all-workspace-files';

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
  rustReferences: NxWorkspaceFilesExternals,
  updatedFiles: Record<string, string>,
  deletedFiles: string[]
) {
  const updates = updateProjectFiles(
    Object.fromEntries(
      createProjectRootMappingsFromProjectConfigurations(projectsConfigurations)
    ),
    rustReferences,
    updatedFiles,
    deletedFiles
  );
  return {
    fileMap: updates.fileMap,
    allWorkspaceFiles: buildAllWorkspaceFiles(
      updates.fileMap.projectFileMap,
      updates.fileMap.nonProjectFiles
    ),
    rustReferences: updates.externalReferences,
  };
}
