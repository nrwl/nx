import { ProjectConfiguration } from '@nrwl/devkit';
import { basename } from 'path';
import { MigrationProjectConfiguration, WorkspaceProjects } from './types';

export function getE2eKey(projects: WorkspaceProjects): string | null {
  for (const project of projects.apps) {
    if (project.config.targets?.e2e) {
      return project.name;
    }
  }

  return null;
}

export function getE2eProject(
  projects: WorkspaceProjects
): MigrationProjectConfiguration | null {
  for (const project of projects.apps) {
    if (project.config.targets?.e2e) {
      return project;
    }
  }

  return null;
}

export function getCypressConfigFile(
  e2eProject: ProjectConfiguration
): string | undefined {
  let cypressConfig = 'cypress.json';
  const configFileOption = e2eProject.targets.e2e.options.configFile;
  if (configFileOption === false) {
    cypressConfig = undefined;
  } else if (typeof configFileOption === 'string') {
    cypressConfig = basename(configFileOption);
  }

  return cypressConfig;
}

export function isCypressE2eProject(e2eProject: ProjectConfiguration): boolean {
  return e2eProject.targets.e2e.executor === '@cypress/schematic:cypress';
}

export function isProtractorE2eProject(
  e2eProject: ProjectConfiguration
): boolean {
  return (
    e2eProject.targets.e2e.executor ===
    '@angular-devkit/build-angular:protractor'
  );
}
