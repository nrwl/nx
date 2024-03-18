import { existsSync } from 'fs';
import * as path from 'path';
import { readJsonFile } from '../utils/fileutils';
import { ProjectsConfigurations } from '../config/workspace-json-project-json';
import { NxPluginV2 } from '../utils/nx-plugin';

export const NX_ANGULAR_JSON_PLUGIN_NAME = 'nx-angular-json-plugin';

export const NxAngularJsonPlugin: NxPluginV2 = {
  name: NX_ANGULAR_JSON_PLUGIN_NAME,
  createNodes: [
    'angular.json',
    (f, _, ctx) => ({
      projects: readAngularJson(ctx.workspaceRoot),
    }),
  ],
};

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
    // nx-ignore-next-line
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

export function toNewFormat(w: any): ProjectsConfigurations {
  if (!w.projects) {
    return w;
  }
  for (const name in w.projects ?? {}) {
    const projectConfig = w.projects[name];
    if (projectConfig.architect) {
      renamePropertyWithStableKeys(projectConfig, 'architect', 'targets');
    }
    if (projectConfig.schematics) {
      renamePropertyWithStableKeys(projectConfig, 'schematics', 'generators');
    }
    if (!projectConfig.name) {
      projectConfig.name = name;
    }

    Object.values(projectConfig.targets || {}).forEach((target: any) => {
      if (target.builder !== undefined) {
        renamePropertyWithStableKeys(target, 'builder', 'executor');
      }
    });
  }

  if (w.schematics) {
    renamePropertyWithStableKeys(w, 'schematics', 'generators');
  }
  if (w.version !== 2) {
    w.version = 2;
  }

  return w;
}

export function toOldFormat(w: any) {
  if (w.projects) {
    for (const name in w.projects) {
      const projectConfig = w.projects[name];
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
    }
  }

  if (w.generators) {
    renamePropertyWithStableKeys(w, 'generators', 'schematics');
  }
  if (w.version !== 1) {
    w.version = 1;
  }
  return w;
}

// we have to do it this way to preserve the order of properties
// not to screw up the formatting
export function renamePropertyWithStableKeys(
  obj: any,
  from: string,
  to: string
) {
  const copy = { ...obj };
  Object.keys(obj).forEach((k) => {
    delete obj[k];
  });
  Object.keys(copy).forEach((k) => {
    if (k === from) {
      obj[to] = copy[k];
    } else {
      obj[k] = copy[k];
    }
  });
}
