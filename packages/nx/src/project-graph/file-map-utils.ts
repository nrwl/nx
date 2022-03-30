import { dirname } from 'path';
import { FileData, ProjectFileMap } from '../config/project-graph';

function createProjectRootMappings(
  workspaceJson: any,
  projectFileMap: ProjectFileMap
) {
  const projectRootMappings = new Map();
  for (const projectName of Object.keys(workspaceJson.projects)) {
    if (!projectFileMap[projectName]) {
      projectFileMap[projectName] = [];
    }
    const root = workspaceJson.projects[projectName].root;
    projectRootMappings.set(
      root.endsWith('/') ? root.substring(0, root.length - 1) : root,
      projectFileMap[projectName]
    );
  }
  return projectRootMappings;
}

function findMatchingProjectFiles(
  projectRootMappings: Map<string, FileData[]>,
  file: string
) {
  for (
    let currentPath = dirname(file);
    currentPath != dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    const p = projectRootMappings.get(currentPath);
    if (p) {
      return p;
    }
  }
  return null;
}

export function createProjectFileMap(
  workspaceJson: any,
  allWorkspaceFiles: FileData[]
): { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] } {
  const projectFileMap: ProjectFileMap = {};
  const projectRootMappings = createProjectRootMappings(
    workspaceJson,
    projectFileMap
  );
  for (const f of allWorkspaceFiles) {
    const matchingProjectFiles = findMatchingProjectFiles(
      projectRootMappings,
      f.file
    );
    if (matchingProjectFiles) {
      matchingProjectFiles.push(f);
    }
  }
  return { projectFileMap, allWorkspaceFiles };
}

export function updateProjectFileMap(
  workspaceJson: any,
  projectFileMap: ProjectFileMap,
  allWorkspaceFiles: FileData[],
  updatedFiles: Map<string, string>,
  deletedFiles: string[]
): { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] } {
  const projectRootMappings = createProjectRootMappings(
    workspaceJson,
    projectFileMap
  );

  for (const f of updatedFiles.keys()) {
    const matchingProjectFiles = findMatchingProjectFiles(
      projectRootMappings,
      f
    );
    if (matchingProjectFiles) {
      const fileData: FileData = matchingProjectFiles.find((t) => t.file === f);
      if (fileData) {
        fileData.hash = updatedFiles.get(f);
      } else {
        matchingProjectFiles.push({
          file: f,
          hash: updatedFiles.get(f),
        });
      }
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
    const matchingProjectFiles = findMatchingProjectFiles(
      projectRootMappings,
      f
    );
    if (matchingProjectFiles) {
      const index = matchingProjectFiles.findIndex((t) => t.file === f);
      if (index > -1) {
        matchingProjectFiles.splice(index, 1);
      }
    }
    const index = allWorkspaceFiles.findIndex((t) => t.file === f);
    if (index > -1) {
      allWorkspaceFiles.splice(index, 1);
    }
  }
  return { projectFileMap, allWorkspaceFiles };
}
