import { Tree, Rule } from '@angular-devkit/schematics';
import { JsonArray, JsonObject, workspaces } from '@angular-devkit/core';
import {
  ProjectDefinition,
  TargetDefinition,
} from '@angular-devkit/core/src/workspace';
import { logger } from '@nrwl/tao/src/shared/logger';
import {
  getWorkspacePath,
  WorkspaceConfiguration,
  Tree as DevkitTree,
} from '@nrwl/devkit';

export function checkWorkspaceVersion(
  workspace: WorkspaceConfiguration,
  host: DevkitTree
) {
  if (workspace.version < 2) {
    logger.error(`
NX Only workspaces with version 2+ support project.json files.
To upgrade change the version number at the top of ${getWorkspacePath(
      host
    )} and run 'nx format'.
`);
    throw new Error('v2+ Required');
  }
}

function createHost(tree: Tree): workspaces.WorkspaceHost {
  return {
    async readFile(path: string): Promise<string> {
      const data = tree.read(path);
      if (!data) {
        throw new Error('File not found.');
      }

      return data.toString();
    },
    async writeFile(path: string, data: string): Promise<void> {
      return tree.overwrite(path, data);
    },
    async isDirectory(path: string): Promise<boolean> {
      // approximate a directory check
      // special case needed when testing wrapped schematics
      if (path === '/') return true;
      return !tree.exists(path) && tree.getDir(path).subfiles.length > 0;
    },
    async isFile(path: string): Promise<boolean> {
      return tree.exists(path);
    },
  };
}
export async function getWorkspace(tree: Tree, path = '/') {
  const host = createHost(tree);

  const { workspace } = await workspaces.readWorkspace(path, host);

  return workspace;
}
export function updateWorkspace(
  updater: (
    workspace: workspaces.WorkspaceDefinition
  ) => void | PromiseLike<void>
): Rule;
export function updateWorkspace(
  workspace: workspaces.WorkspaceDefinition
): Rule;
export function updateWorkspace(
  updaterOrWorkspace:
    | workspaces.WorkspaceDefinition
    | ((workspace: workspaces.WorkspaceDefinition) => void | PromiseLike<void>)
): Rule {
  return async (tree: Tree) => {
    const host = createHost(tree);

    if (typeof updaterOrWorkspace === 'function') {
      const { workspace } = await workspaces.readWorkspace('/', host);

      const result = updaterOrWorkspace(workspace);
      if (result !== undefined) {
        await result;
      }

      await workspaces.writeWorkspace(workspace, host);
    } else {
      await workspaces.writeWorkspace(updaterOrWorkspace, host);
    }
  };
}

/**
 * Updates builder options for options and configurations for given builder names
 */
export function updateBuilderConfig(
  updater: (
    currentValue: Record<
      string,
      string | number | boolean | JsonArray | JsonObject
    >,
    target?: TargetDefinition,
    project?: ProjectDefinition
  ) => Record<string, string | number | boolean | JsonArray | JsonObject>,
  ...builderNames: string[]
) {
  return updateWorkspace((workspace) => {
    if (!workspace.projects) {
      return;
    }
    workspace.projects.forEach((project) => {
      project.targets.forEach((target) => {
        if (!builderNames.includes(target.builder)) {
          return;
        }
        if (target.options) {
          target.options = updater(target.options, target, project);
        }
        if (!target.configurations) {
          return;
        }
        Object.entries(target.configurations).forEach(
          ([configName, options]) => {
            target.configurations[configName] = updater(
              options,
              target,
              project
            );
          }
        );
      });
    });
  });
}
