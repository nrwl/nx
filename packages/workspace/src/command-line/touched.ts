import { join } from 'path';

import {
  ImplicitDependencies,
  readWorkspaceJson,
  getProjectNodes,
  readNxJson,
  getImplicitDependencies,
  ProjectNode
} from './shared';
import { appRootPath } from '../utils/app-root';

export function touchedProjects(
  implicitDependencies: ImplicitDependencies,
  projects: ProjectNode[],
  touchedFiles: string[]
): string[] {
  projects = normalizeProjects(projects);
  touchedFiles = normalizeFiles(touchedFiles);
  const itp = implicitlyTouchedProjects(implicitDependencies, touchedFiles);
  // Return if all projects were implicitly touched
  if (itp.length === projects.length) {
    return itp;
  }
  const dtp = directlyTouchedProjects(projects, touchedFiles);
  return projects
    .filter(project => itp.includes(project.name) || dtp.includes(project.name))
    .map(project => project.name);
}

export function getTouchedProjects(touchedFiles: string[]): string[] {
  const workspaceJson = readWorkspaceJson();
  const nxJson = readNxJson();
  const projects = getProjectNodes(workspaceJson, nxJson);
  const implicitDeps = getImplicitDependencies(projects, workspaceJson, nxJson);
  return touchedProjects(implicitDeps, projects, touchedFiles).filter(p => !!p);
}

function implicitlyTouchedProjects(
  implicitDependencies: ImplicitDependencies,
  touchedFiles: string[]
): string[] {
  return Array.from(
    Object.entries(implicitDependencies.files).reduce(
      (projectSet, [file, projectNames]) => {
        if (touchedFiles.find(tf => tf === file)) {
          projectNames.forEach(projectName => {
            projectSet.add(projectName);
          });
        }
        return projectSet;
      },
      new Set<string>()
    )
  );
}

function directlyTouchedProjects(
  projects: ProjectNode[],
  touchedFiles: string[]
) {
  return projects
    .filter(project => {
      return touchedFiles.some(file => {
        return project.files.some(projectFile => projectFile === file);
      });
    })
    .map(project => project.name);
}

function normalizeProjects(projects: ProjectNode[]) {
  return projects.map(p => {
    return {
      ...p,
      files: normalizeFiles(p.files)
    };
  });
}

function normalizeFiles(files: string[]): string[] {
  return files.map(f => f.replace(/[\\\/]+/g, '/'));
}
