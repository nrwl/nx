import type { Rule, Tree } from '@angular-devkit/schematics';
import { JsonArray, JsonObject, workspaces } from '@angular-devkit/core';
import {
  ProjectDefinition,
  TargetDefinition,
} from '@angular-devkit/core/src/workspace';

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

/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'getProjects' with Nx Devkit.
 */
export async function getWorkspace(tree: Tree, path = '/') {
  const host = createHost(tree);

  const { workspace } = await workspaces.readWorkspace(path, host);

  return workspace;
}

/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'updateProjectConfiguration' with Nx Devkit.
 */
export function updateWorkspace(
  updater: (
    workspace: workspaces.WorkspaceDefinition
  ) => void | PromiseLike<void>
): Rule;
/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'updateProjectConfiguration' with Nx Devkit.
 */
export function updateWorkspace(
  workspace: workspaces.WorkspaceDefinition
): Rule;
/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'updateProjectConfiguration' with Nx Devkit.
 */
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
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'forEachExecutorOptions' with Nx Devkit.
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
