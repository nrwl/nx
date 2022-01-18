import type { FileData } from '@nrwl/devkit';
import { ProjectFileMap } from '@nrwl/devkit';

function sortProjects(workspaceJson: any) {
  // Sorting here so `apps/client-e2e` comes before `apps/client` and has
  // a chance to match prefix first.
  return Object.keys(workspaceJson.projects).sort((a, b) => {
    const projectA = workspaceJson.projects[a];
    const projectB = workspaceJson.projects[b];
    if (!projectA.root) return -1;
    if (!projectB.root) return -1;
    return projectA.root.length > projectB.root.length ? -1 : 1;
  });
}

export function createProjectFileMap(
  workspaceJson: any,
  allWorkspaceFiles: FileData[]
): { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] } {
  const projectFileMap: ProjectFileMap = {};
  const sortedProjects = sortProjects(workspaceJson);
  const seen = new Set();

  for (const projectName of sortedProjects) {
    projectFileMap[projectName] = [];
  }
  for (const f of allWorkspaceFiles) {
    if (seen.has(f.file)) continue;
    seen.add(f.file);
    for (const projectName of sortedProjects) {
      const p = workspaceJson.projects[projectName];
      if (f.file.startsWith(p.root || p.sourceRoot)) {
        projectFileMap[projectName].push(f);
        break;
      }
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
  const sortedProjects = sortProjects(workspaceJson);
  for (let projectName of sortedProjects) {
    if (!projectFileMap[projectName]) {
      projectFileMap[projectName] = [];
    }
  }

  for (const f of updatedFiles.keys()) {
    for (const projectName of sortedProjects) {
      const p = workspaceJson.projects[projectName];
      if (f.startsWith(p.root || p.sourceRoot)) {
        const fileData: FileData = projectFileMap[projectName].find(
          (t) => t.file === f
        );
        if (fileData) {
          fileData.hash = updatedFiles.get(f);
        } else {
          projectFileMap[projectName].push({
            file: f,
            hash: updatedFiles.get(f),
          });
        }
        break;
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
    for (const projectName of sortedProjects) {
      const p = workspaceJson.projects[projectName];
      if (f.startsWith(p.root || p.sourceRoot)) {
        const index = projectFileMap[projectName].findIndex(
          (t) => t.file === f
        );
        if (index > -1) {
          projectFileMap[projectName].splice(index, 1);
        }
        break;
      }
    }
    const index = allWorkspaceFiles.findIndex((t) => t.file === f);
    if (index > -1) {
      allWorkspaceFiles.splice(index, 1);
    }
  }
  return { projectFileMap, allWorkspaceFiles };
}
