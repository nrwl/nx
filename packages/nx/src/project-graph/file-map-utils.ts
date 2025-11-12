import {
  FileData,
  FileMap,
  ProjectFileMap,
  ProjectGraph,
} from '../config/project-graph.js';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json.js';
import { daemonClient } from '../daemon/client/client.js';
import { NxWorkspaceFilesExternals } from '../native/index.js';
import {
  getAllFileDataInContext,
  updateProjectFiles,
} from '../utils/workspace-context.js';
import { workspaceRoot } from '../utils/workspace-root.js';
import { readProjectsConfigurationFromProjectGraph } from './project-graph.js';
import { buildAllWorkspaceFiles } from './utils/build-all-workspace-files.js';
import {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from './utils/find-project-for-path.js';

export interface WorkspaceFileMap {
  allWorkspaceFiles: FileData[];
  fileMap: FileMap;
}

export async function createProjectFileMapUsingProjectGraph(
  graph: ProjectGraph
): Promise<ProjectFileMap> {
  return (await createFileMapUsingProjectGraph(graph)).fileMap.projectFileMap;
}

// TODO: refactor this to pull straight from the rust context instead of creating the file map in JS
export async function createFileMapUsingProjectGraph(
  graph: ProjectGraph
): Promise<WorkspaceFileMap> {
  const configs = readProjectsConfigurationFromProjectGraph(graph);

  let files: FileData[] = await getAllFileDataInContext(workspaceRoot);

  return createFileMap(configs, files);
}

export function createFileMap(
  projectsConfigurations: ProjectsConfigurations,
  allWorkspaceFiles: FileData[]
): WorkspaceFileMap {
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
