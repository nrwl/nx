import { existsSync } from 'fs';
import * as path from 'path';
import { readJsonFile } from '../utils/fileutils';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { renamePropertyWithStableKeys } from '../config/workspaces';
import { workspaceRoot } from '../utils/workspace-root';

export function shouldMergeAngularProjects(
  root: string,
  includeProjectsFromAngularJson: boolean
): boolean {
  if (
    existsSync(path.join(root, 'angular.json')) &&
    // Include projects from angular.json if explicitly required.
    // e.g. when invoked from `packages/devkit/src/utils/convert-nx-executor.ts`
    (includeProjectsFromAngularJson ||
      // Or if a workspace has `@nrwl/angular`/`@nx/angular` installed then projects from `angular.json` to be considered by Nx.
      isAngularPluginInstalled())
  ) {
    return true;
  } else {
    return false;
  }
}

export function isAngularPluginInstalled() {
  try {
    require.resolve('@nx/angular');
    return true;
  } catch {
    try {
      require.resolve('@nrwl/angular');
      return true;
    } catch {
      return false;
    }
  }
}

function readAngularJson(angularCliWorkspaceRoot: string) {
  return toNewFormat(
    readJsonFile(path.join(angularCliWorkspaceRoot, 'angular.json'))
  ).projects;
}

export function mergeAngularJsonAndProjects(
  projects: {
    [name: string]: ProjectConfiguration;
  },
  angularCliWorkspaceRoot: string
): { [name: string]: ProjectConfiguration } {
  const res = readAngularJson(angularCliWorkspaceRoot);
  const folders = new Set();
  for (let k of Object.keys(res)) {
    folders.add(res[k].root);
  }
  for (let k of Object.keys(projects)) {
    if (!folders.has(projects[k].root)) {
      res[k] = projects[k];
    }
  }
  return res;
}

export function toNewFormat(w: any): ProjectsConfigurations {
  Object.values(w.projects || {}).forEach((projectConfig: any) => {
    if (projectConfig.architect) {
      renamePropertyWithStableKeys(projectConfig, 'architect', 'targets');
    }
    if (projectConfig.schematics) {
      renamePropertyWithStableKeys(projectConfig, 'schematics', 'generators');
    }
    Object.values(projectConfig.targets || {}).forEach((target: any) => {
      if (target.builder !== undefined) {
        renamePropertyWithStableKeys(target, 'builder', 'executor');
      }
    });
  });
  if (w.schematics) {
    renamePropertyWithStableKeys(w, 'schematics', 'generators');
  }
  if (w.version !== 2) {
    w.version = 2;
  }
  return w;
}

export function toOldFormat(w: any) {
  Object.values(w.projects || {}).forEach((projectConfig: any) => {
    if (typeof projectConfig === 'string') {
      throw new Error(
        "'project.json' files are incompatible with version 1 workspace schemas."
      );
    }
    if (projectConfig.targets) {
      renamePropertyWithStableKeys(projectConfig, 'targets', 'architect');
    }
    if (projectConfig.generators) {
      renamePropertyWithStableKeys(projectConfig, 'generators', 'schematics');
    }
    delete projectConfig.name;
    Object.values(projectConfig.architect || {}).forEach((target: any) => {
      if (target.executor !== undefined) {
        renamePropertyWithStableKeys(target, 'executor', 'builder');
      }
    });
  });

  if (w.generators) {
    renamePropertyWithStableKeys(w, 'generators', 'schematics');
  }
  if (w.version !== 1) {
    w.version = 1;
  }
  return w;
}
